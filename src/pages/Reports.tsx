import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { FiDownload, FiFilter, FiCalendar, FiPieChart, FiBarChart2, FiClock, FiPrinter, FiFileText, FiAlertCircle, FiDollarSign, FiUsers } from 'react-icons/fi'
import { format, parseISO, differenceInSeconds, startOfMonth, endOfMonth } from 'date-fns'
import { formatDate, formatCurrency, startOfWeek, endOfWeek, formatMonthYear } from '../utils/localization'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie } from 'recharts'
// Import jsPDF dynamically to avoid SSR issues
import jspdf from 'jspdf'
// Import jspdf-autotable dynamically
import 'jspdf-autotable'

// Ensure jsPDF is properly typed
declare global {
  interface Window {
    jspdf: any;
  }
}

interface Customer {
  id: string;
  name: string;
}

interface Project {
  id: string;
  name: string;
  customer_id: string;
  customer?: Customer;
}

interface Task {
  id: string;
  name: string;
}

interface TimeEntry {
  id: string;
  task_id: string;
  customer_id?: string;
  start_time: string | null;
  end_time: string | null;
  description: string;
  task: Task;
  customer?: Customer;
  duration_minutes: number | null;
  date: string | null;
  billable: boolean;
  rate: number | null;
}

interface ReportFilters {
  dateFrom: string;
  dateTo: string;
  customer: string;
  project: string;
  groupBy: 'customer' | 'project' | 'task' | 'day';
  billableOnly: boolean;
}

interface ReportData {
  name: string;
  value: number;
  seconds: number;
  billableHours: number;
  nonBillableHours: number;
}

interface PeriodSummary {
  period: string;
  totalHours: number;
  billableHours: number;
  nonBillableHours: number;
  billablePercentage: number;
}

interface ClientSummary {
  clientId: string;
  clientName: string;
  totalHours: number;
  billableHours: number;
  nonBillableHours: number;
  billableAmount: number;
}

interface DatabaseState {
  totalCustomers: number;
  totalProjects: number;
  totalTasks: number;
  customersWithProjects: Array<{id: string, name: string, projectCount: number}>;
  projectsWithTasks: Array<{id: string, name: string, customerName: string, taskCount: number}>;
  tasksWithEntries: Array<{id: string, name: string, entryCount: number, customerName: string}>;
}

export default function Reports() {
  const { user } = useAuth()
  const [timeEntries, setTimeEntries] = useState<TimeEntry[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [reportData, setReportData] = useState<ReportData[]>([])
  const [totalHours, setTotalHours] = useState(0)
  const [totalBillableHours, setTotalBillableHours] = useState(0)
  const [totalNonBillableHours, setTotalNonBillableHours] = useState(0)
  const [periodSummaries, setPeriodSummaries] = useState<PeriodSummary[]>([])
  const [clientSummaries, setClientSummaries] = useState<ClientSummary[]>([])
  const [filters, setFilters] = useState<ReportFilters>({
    dateFrom: format(startOfWeek(new Date()), 'yyyy-MM-dd'),
    dateTo: format(endOfWeek(new Date()), 'yyyy-MM-dd'),
    customer: '',
    project: '',
    groupBy: 'customer',
    billableOnly: false
  })
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false)
  const [selectedPeriodView, setSelectedPeriodView] = useState<'week' | 'month' | 'quarter'>('week')
  const reportRef = useRef<HTMLDivElement>(null)
  
  // Debug states
  const [debugMode, setDebugMode] = useState(false)
  const [databaseState, setDatabaseState] = useState<DatabaseState | null>(null)
  const [debugInfo, setDebugInfo] = useState({
    timeEntriesCount: 0,
    filteredEntriesCount: 0,
    reportDataCount: 0,
    renderCount: 0,
    chartDimensions: { width: 0, height: 0 },
    errors: [] as string[],
    rawData: null as any,
    clientDebug: {
      totalEntries: 0,
      entriesWithCustomer: 0,
      entriesWithoutCustomer: 0,
      uniqueCustomers: [] as string[],
      customerBreakdown: {} as Record<string, number>
    }
  })

  // Track render count for debugging
  const renderCountRef = useRef(0)
  useEffect(() => {
    renderCountRef.current += 1
    setDebugInfo(prev => ({
      ...prev,
      renderCount: renderCountRef.current
    }))
  })

  // Initial data fetch
  useEffect(() => {
    if (!user) return
    fetchTimeEntries()
    fetchCustomers()
    fetchProjects()
  }, [user])

  const calculateDuration = useCallback((entry: TimeEntry): number => {
    if (entry.duration_minutes) {
      return entry.duration_minutes * 60
    } else if (entry.start_time && entry.end_time) {
      const startTime = new Date(entry.start_time)
      const endTime = new Date(entry.end_time)
      return differenceInSeconds(endTime, startTime)
    } else if (entry.start_time) {
      const startTime = new Date(entry.start_time)
      const endTime = new Date()
      return differenceInSeconds(endTime, startTime)
    }
    return 0
  }, [])

  const filterTimeEntries = useCallback((entries: TimeEntry[]): TimeEntry[] => {
    return entries.filter(entry => {
      // Get the relevant date for filtering
      const entryDate = entry.date 
        ? new Date(entry.date) 
        : entry.start_time 
          ? new Date(entry.start_time) 
          : new Date()
      
      // Apply date filters
      if (filters.dateFrom) {
        const fromDate = new Date(filters.dateFrom)
        fromDate.setHours(0, 0, 0, 0)
        if (entryDate < fromDate) return false
      }
      
      if (filters.dateTo) {
        const toDate = new Date(filters.dateTo)
        toDate.setHours(23, 59, 59, 999)
        if (entryDate > toDate) return false
      }
      
      // Apply customer filter - now using direct customer relationship
      if (filters.customer && entry.customer_id !== filters.customer) {
        return false
      }
      
      // Apply project filter - removed since tasks are independent
      if (filters.project) {
        // Since tasks are independent, we can't filter by project
        return false
      }

      // Apply billable filter
      if (filters.billableOnly && !entry.billable) {
        return false
      }
      
      return true
    })
  }, [filters])

  const generateReport = useCallback(() => {
    const filteredEntries = filterTimeEntries(timeEntries)
    
    setDebugInfo(prev => ({
      ...prev,
      filteredEntriesCount: filteredEntries.length
    }))
    
    // Group data based on selected groupBy option
    const groupedData: Record<string, { total: number, billable: number, nonBillable: number }> = {}
    let totalSeconds = 0
    let totalBillableSeconds = 0
    let totalNonBillableSeconds = 0
    
    filteredEntries.forEach(entry => {
      const durationInSeconds = calculateDuration(entry)
      
      let key = ''
      
      switch (filters.groupBy) {
        case 'customer':
          key = entry.customer?.name || 'Unknown Customer'
          break
        case 'project':
          // Since tasks are independent, we can't group by project
          key = 'Unknown Project'
          break
        case 'task':
          key = entry.task?.name || 'Unknown Task'
          break
        case 'day':
          const entryDate = entry.date 
            ? new Date(entry.date) 
            : entry.start_time 
              ? new Date(entry.start_time) 
              : new Date()
          key = format(entryDate, 'yyyy-MM-dd')
          break
      }
      
      if (!groupedData[key]) {
        groupedData[key] = { total: 0, billable: 0, nonBillable: 0 }
      }
      
      groupedData[key].total += durationInSeconds
      
      if (entry.billable) {
        groupedData[key].billable += durationInSeconds
        totalBillableSeconds += durationInSeconds
      } else {
        groupedData[key].nonBillable += durationInSeconds
        totalNonBillableSeconds += durationInSeconds
      }
      
      totalSeconds += durationInSeconds
    })
    
    // Convert to array format for charts
    const data: ReportData[] = Object.entries(groupedData).map(([name, durations]) => ({
      name: filters.groupBy === 'day' ? formatDate(parseISO(name), 'dd MMM') : name,
      value: Math.round(durations.total / 3600 * 100) / 100,
      seconds: durations.total,
      billableHours: Math.round(durations.billable / 3600 * 100) / 100,
      nonBillableHours: Math.round(durations.nonBillable / 3600 * 100) / 100
    }))
    
    // Sort data
    if (filters.groupBy === 'day') {
      data.sort((a, b) => {
        const dateA = new Date(a.name)
        const dateB = new Date(b.name)
        return dateA.getTime() - dateB.getTime()
      })
    } else {
      data.sort((a, b) => b.seconds - a.seconds)
    }
    
    setReportData(data)
    setTotalHours(Math.round(totalSeconds / 3600 * 100) / 100)
    setTotalBillableHours(Math.round(totalBillableSeconds / 3600 * 100) / 100)
    setTotalNonBillableHours(Math.round(totalNonBillableSeconds / 3600 * 100) / 100)
    
    setDebugInfo(prev => ({
      ...prev,
      reportDataCount: data.length
    }))
  }, [timeEntries, filters, calculateDuration, filterTimeEntries])

  const generatePeriodSummaries = useCallback(() => {
    const filteredEntries = filterTimeEntries(timeEntries)
    const summaries: PeriodSummary[] = []
    
    // Group by selected period
    const periodGroups: Record<string, TimeEntry[]> = {}
    
    filteredEntries.forEach(entry => {
      const entryDate = entry.date 
        ? new Date(entry.date) 
        : entry.start_time 
          ? new Date(entry.start_time) 
          : new Date()
      
      let periodKey = ''
      
      switch (selectedPeriodView) {
        case 'week':
          const weekStart = startOfWeek(entryDate)
          periodKey = format(weekStart, 'yyyy-MM-dd')
          break
        case 'month':
          periodKey = format(entryDate, 'yyyy-MM')
          break
        case 'quarter':
          const quarter = Math.floor(entryDate.getMonth() / 3) + 1
          periodKey = `${entryDate.getFullYear()}-Q${quarter}`
          break
      }
      
      if (!periodGroups[periodKey]) {
        periodGroups[periodKey] = []
      }
      periodGroups[periodKey].push(entry)
    })
    
    // Calculate summaries for each period
    Object.entries(periodGroups).forEach(([period, entries]) => {
      let totalSeconds = 0
      let billableSeconds = 0
      let nonBillableSeconds = 0
      
      entries.forEach(entry => {
        const duration = calculateDuration(entry)
        totalSeconds += duration
        
        if (entry.billable) {
          billableSeconds += duration
        } else {
          nonBillableSeconds += duration
        }
      })
      
      const totalHours = totalSeconds / 3600
      const billableHours = billableSeconds / 3600
      const nonBillableHours = nonBillableSeconds / 3600
      
      summaries.push({
        period: selectedPeriodView === 'week' 
          ? `Week of ${formatDate(parseISO(period))}`
          : selectedPeriodView === 'month'
            ? formatMonthYear(parseISO(period + '-01'))
            : period,
        totalHours: Math.round(totalHours * 100) / 100,
        billableHours: Math.round(billableHours * 100) / 100,
        nonBillableHours: Math.round(nonBillableHours * 100) / 100,
        billablePercentage: totalHours > 0 ? Math.round((billableHours / totalHours) * 100) : 0
      })
    })
    
    // Sort summaries by period
    summaries.sort((a, b) => a.period.localeCompare(b.period))
    
    setPeriodSummaries(summaries)
  }, [timeEntries, selectedPeriodView, calculateDuration, filterTimeEntries])

  const generateClientSummaries = useCallback(() => {
    // Use ALL time entries, not filtered ones, for client overview
    const allEntries = timeEntries
    const clientGroups: Record<string, { entries: TimeEntry[], customer: Customer }> = {}
    
    // Debug information
    let totalEntries = 0
    let entriesWithCustomer = 0
    let entriesWithoutCustomer = 0
    const uniqueCustomers: string[] = []
    const customerBreakdown: Record<string, number> = {}
    
    // Group by customer using direct customer relationship
    allEntries.forEach(entry => {
      totalEntries++
      
      // Debug: Log the structure of each entry
      console.log('Time entry structure:', {
        id: entry.id,
        customer_id: entry.customer_id,
        customer: entry.customer
      })
      
      const customer = entry.customer
      if (customer && entry.customer_id) {
        entriesWithCustomer++
        
        if (!uniqueCustomers.includes(customer.name)) {
          uniqueCustomers.push(customer.name)
        }
        
        customerBreakdown[customer.name] = (customerBreakdown[customer.name] || 0) + 1
        
        if (!clientGroups[customer.id]) {
          clientGroups[customer.id] = { entries: [], customer }
        }
        clientGroups[customer.id].entries.push(entry)
      } else {
        entriesWithoutCustomer++
        console.log('Entry without customer:', {
          entryId: entry.id,
          customer_id: entry.customer_id,
          hasCustomer: !!entry.customer
        })
      }
    })
    
    // Update debug info
    setDebugInfo(prev => ({
      ...prev,
      clientDebug: {
        totalEntries,
        entriesWithCustomer,
        entriesWithoutCustomer,
        uniqueCustomers,
        customerBreakdown
      }
    }))
    
    console.log('Client debug info:', {
      totalEntries,
      entriesWithCustomer,
      entriesWithoutCustomer,
      uniqueCustomers,
      customerBreakdown,
      clientGroupsKeys: Object.keys(clientGroups)
    })
    
    // Calculate summaries for each client
    const summaries: ClientSummary[] = Object.entries(clientGroups).map(([clientId, { entries, customer }]) => {
      let totalSeconds = 0
      let billableSeconds = 0
      let nonBillableSeconds = 0
      let billableAmount = 0
      
      entries.forEach(entry => {
        const duration = calculateDuration(entry)
        totalSeconds += duration
        
        if (entry.billable) {
          billableSeconds += duration
          
          // Calculate billable amount using the rate from the time entry
          if (entry.rate && entry.rate > 0) {
            const hours = duration / 3600
            billableAmount += hours * entry.rate
          }
        } else {
          nonBillableSeconds += duration
        }
      })
      
      const totalHours = totalSeconds / 3600
      const billableHours = billableSeconds / 3600
      const nonBillableHours = nonBillableSeconds / 3600
      
      return {
        clientId,
        clientName: customer.name,
        totalHours: Math.round(totalHours * 100) / 100,
        billableHours: Math.round(billableHours * 100) / 100,
        nonBillableHours: Math.round(nonBillableHours * 100) / 100,
        billableAmount: Math.round(billableAmount * 100) / 100
      }
    })
    
    // Filter out clients with zero hours
    const nonZeroSummaries = summaries.filter(summary => summary.totalHours > 0)
    
    // Sort by total hours descending
    nonZeroSummaries.sort((a, b) => b.totalHours - a.totalHours)
    
    console.log('Final client summaries:', nonZeroSummaries)
    
    setClientSummaries(nonZeroSummaries)
  }, [timeEntries, calculateDuration])

  // Generate reports when data or filters change
  useEffect(() => {
    if (timeEntries.length > 0) {
      generateReport()
      generatePeriodSummaries()
      generateClientSummaries()
    }
    
    // Update debug info
    setDebugInfo(prev => ({
      ...prev,
      timeEntriesCount: timeEntries.length
    }))
  }, [timeEntries, generateReport, generatePeriodSummaries, generateClientSummaries])

  const fetchTimeEntries = async () => {
    try {
      setLoading(true)
      
      const { data, error } = await supabase
        .from('time_entries')
        .select(`
          *,
          task:tasks(id, name),
          customer:customers(id, name)
        `)
        .eq('user_id', user?.id)
        .order('start_time', { ascending: false })
      
      if (error) {
        console.error('Supabase error:', error)
        setDebugInfo(prev => ({
          ...prev,
          errors: [...prev.errors, `Fetch error: ${error.message}`]
        }))
        throw error
      }
      
      // Store raw data for debugging
      setDebugInfo(prev => ({
        ...prev,
        rawData: data
      }))
      
      setTimeEntries(data as unknown as TimeEntry[] || [])
    } catch (error: any) {
      console.error('Error fetching time entries:', error.message)
      setDebugInfo(prev => ({
        ...prev,
        errors: [...prev.errors, `Fetch error: ${error.message}`]
      }))
    } finally {
      setLoading(false)
    }
  }

  const fetchCustomers = async () => {
    try {
      const { data, error } = await supabase
        .from('customers')
        .select('id, name')
        .eq('user_id', user?.id)
        .order('name')
      
      if (error) throw error
      
      setCustomers(data || [])
    } catch (error: any) {
      console.error('Error fetching customers:', error.message)
      setDebugInfo(prev => ({
        ...prev,
        errors: [...prev.errors, `Customer fetch error: ${error.message}`]
      }))
    }
  }

  const fetchProjects = async () => {
    try {
      const { data, error } = await supabase
        .from('projects')
        .select('id, name, customer_id')
        .eq('user_id', user?.id)
        .order('name')
      
      if (error) throw error
      
      const projectsWithCustomer = (data || []).map(project => ({
        id: project.id,
        name: project.name,
        customer_id: project.customer_id
      })) as Project[]
      
      setProjects(projectsWithCustomer)
    } catch (error: any) {
      console.error('Error fetching projects:', error.message)
      setDebugInfo(prev => ({
        ...prev,
        errors: [...prev.errors, `Project fetch error: ${error.message}`]
      }))
    }
  }

  const fetchDatabaseState = async () => {
    try {
      // Get all customers
      const { data: customersData } = await supabase
        .from('customers')
        .select('id, name')
        .eq('user_id', user?.id)

      // Get all projects with customer info
      const { data: projectsData } = await supabase
        .from('projects')
        .select(`
          id, 
          name, 
          customer_id,
          customer:customers(id, name)
        `)
        .eq('user_id', user?.id)

      // Get all tasks
      const { data: tasksData } = await supabase
        .from('tasks')
        .select('id, name')
        .eq('user_id', user?.id)

      // Count time entries per task with customer info
      const { data: timeEntriesCount } = await supabase
        .from('time_entries')
        .select(`
          task_id,
          customer:customers(id, name)
        `)
        .eq('user_id', user?.id)

      // Process the data
      const customersWithProjects = (customersData || []).map(customer => {
        const projectCount = (projectsData || []).filter(p => p.customer_id === customer.id).length
        return {
          id: customer.id,
          name: customer.name,
          projectCount
        }
      })

      const projectsWithTasks = (projectsData || []).map(project => {
        // Since tasks are independent, we can't directly link them to projects
        const taskCount = 0
        return {
          id: project.id,
          name: project.name,
          customerName: (project as any).customer?.name || 'Unknown',
          taskCount
        }
      })

      const tasksWithEntries = (tasksData || []).map(task => {
        const entriesForTask = (timeEntriesCount || []).filter(e => e.task_id === task.id)
        const entryCount = entriesForTask.length
        // Get customer name from the first entry (they should all be the same customer now)
        const customerName = entriesForTask.length > 0 && entriesForTask[0].customer 
          ? (entriesForTask[0].customer as any).name 
          : 'Unknown'
        
        return {
          id: task.id,
          name: task.name,
          entryCount,
          customerName
        }
      })

      setDatabaseState({
        totalCustomers: customersData?.length || 0,
        totalProjects: projectsData?.length || 0,
        totalTasks: tasksData?.length || 0,
        customersWithProjects,
        projectsWithTasks,
        tasksWithEntries
      })

    } catch (error: any) {
      console.error('Error fetching database state:', error)
      setDebugInfo(prev => ({
        ...prev,
        errors: [...prev.errors, `Database state error: ${error.message}`]
      }))
    }
  }

  const openFilterModal = () => {
    setIsFilterModalOpen(true)
  }

  const closeFilterModal = () => {
    setIsFilterModalOpen(false)
  }

  const handleFilterChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target
    const checked = type === 'checkbox' ? (e.target as HTMLInputElement).checked : undefined
    
    setFilters(prev => ({ 
      ...prev, 
      [name]: type === 'checkbox' ? checked : value 
    }))
  }

  const applyFilters = () => {
    closeFilterModal()
    // Reports will regenerate automatically due to useEffect dependency on filters
  }

  const setDateRange = (range: 'today' | 'thisWeek' | 'thisMonth' | 'lastMonth' | 'allTime') => {
    const today = new Date()
    
    switch (range) {
      case 'today':
        setFilters(prev => ({
          ...prev,
          dateFrom: format(today, 'yyyy-MM-dd'),
          dateTo: format(today, 'yyyy-MM-dd')
        }))
        break
      case 'thisWeek':
        setFilters(prev => ({
          ...prev,
          dateFrom: format(startOfWeek(today), 'yyyy-MM-dd'),
          dateTo: format(endOfWeek(today), 'yyyy-MM-dd')
        }))
        break
      case 'thisMonth':
        setFilters(prev => ({
          ...prev,
          dateFrom: format(startOfMonth(today), 'yyyy-MM-dd'),
          dateTo: format(endOfMonth(today), 'yyyy-MM-dd')
        }))
        break
      case 'lastMonth':
        const lastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1)
        setFilters(prev => ({
          ...prev,
          dateFrom: format(startOfMonth(lastMonth), 'yyyy-MM-dd'),
          dateTo: format(endOfMonth(lastMonth), 'yyyy-MM-dd')
        }))
        break
      case 'allTime':
        setFilters(prev => ({
          ...prev,
          dateFrom: '',
          dateTo: ''
        }))
        break
    }
  }

  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    
    return `${hours}h ${minutes}m`
  }

  const exportCSV = () => {
    if (reportData.length === 0) return
    
    try {
      // Create CSV content
      let csvContent = 'data:text/csv;charset=utf-8,'
      
      // Add headers
      csvContent += `${filters.groupBy.charAt(0).toUpperCase() + filters.groupBy.slice(1)},Total Hours,Billable Hours,Non-Billable Hours,Duration\n`
      
      // Add data rows
      reportData.forEach(item => {
        csvContent += `"${item.name}",${item.value},${item.billableHours},${item.nonBillableHours},${formatDuration(item.seconds)}\n`
      })
      
      // Add total
      csvContent += `Total,${totalHours},${totalBillableHours},${totalNonBillableHours},${formatDuration(totalHours * 3600)}\n`
      
      // Create download link
      const encodedUri = encodeURI(csvContent)
      const link = document.createElement('a')
      link.setAttribute('href', encodedUri)
      link.setAttribute('download', `time-report-by-${filters.groupBy}-${format(new Date(), 'yyyy-MM-dd')}.csv`)
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    } catch (error) {
      console.error('Error exporting CSV:', error)
      alert('Failed to export CSV. Please check console for details.')
    }
  }

  const exportPDF = () => {
    if (reportData.length === 0) return
    
    try {
      // Create new PDF document
      const doc = new jspdf()
      
      // Add title
      const title = `Time Report by ${filters.groupBy.charAt(0).toUpperCase() + filters.groupBy.slice(1)}`
      doc.setFontSize(18)
      doc.text(title, 14, 22)
      
      // Add date range
      doc.setFontSize(11)
      let dateRangeText = 'Period: '
      if (filters.dateFrom) {
        dateRangeText += `From ${formatDate(parseISO(filters.dateFrom))} `
      } else {
        dateRangeText += 'All time '
      }
      
      if (filters.dateTo) {
        dateRangeText += `to ${formatDate(parseISO(filters.dateTo))}`
      } else {
        dateRangeText += 'to Present'
      }
      
      doc.text(dateRangeText, 14, 32)
      
      // Add totals
      doc.text(`Total Hours: ${totalHours.toFixed(2)} | Billable: ${totalBillableHours.toFixed(2)} | Non-Billable: ${totalNonBillableHours.toFixed(2)}`, 14, 39)
      
      // Add table
      const tableColumn = [filters.groupBy.charAt(0).toUpperCase() + filters.groupBy.slice(1), 'Total Hours', 'Billable Hours', 'Non-Billable Hours', 'Percentage']
      const tableRows = reportData.map(item => [
        item.name,
        item.value.toFixed(2),
        item.billableHours.toFixed(2),
        item.nonBillableHours.toFixed(2),
        `${((item.value / totalHours) * 100).toFixed(1)}%`
      ])
      
      // Add total row
      tableRows.push(['Total', totalHours.toFixed(2), totalBillableHours.toFixed(2), totalNonBillableHours.toFixed(2), '100%'])
      
      // @ts-ignore - jspdf-autotable types are not properly recognized
      doc.autoTable({
        head: [tableColumn],
        body: tableRows,
        startY: 50,
        theme: 'grid',
        styles: { fontSize: 10, cellPadding: 3 },
        headStyles: { fillColor: [41, 128, 185], textColor: 255 },
        footStyles: { fillColor: [220, 220, 220], textColor: 0, fontStyle: 'bold' },
        alternateRowStyles: { fillColor: [245, 245, 245] }
      })
      
      // Save the PDF
      doc.save(`time-report-by-${filters.groupBy}-${format(new Date(), 'yyyy-MM-dd')}.pdf`)
    } catch (error) {
      console.error('Error exporting PDF:', error)
      alert('Failed to export PDF. Please check console for details.')
    }
  }

  const printReport = () => {
    if (!reportRef.current) return
    
    try {
      const printWindow = window.open('', '_blank')
      if (!printWindow) {
        alert('Pop-up blocked. Please allow pop-ups for this site to print reports.')
        return
      }
      
      printWindow.document.write(`
        <html>
          <head>
            <title>Time Report</title>
            <style>
              body { font-family: Arial, sans-serif; padding: 20px; }
              h1 { color: #333; }
              table { width: 100%; border-collapse: collapse; margin-top: 20px; }
              th, td { padding: 10px; text-align: left; border-bottom: 1px solid #ddd; }
              th { background-color: #f2f2f2; }
              .total-row { font-weight: bold; background-color: #f2f2f2; }
              .header { margin-bottom: 20px; }
              .filters { margin-bottom: 15px; color: #666; }
              @media print {
                button { display: none; }
              }
            </style>
          </head>
          <body>
            <div class="header">
              <h1>Time Report by ${filters.groupBy.charAt(0).toUpperCase() + filters.groupBy.slice(1)}</h1>
              <div class="filters">
                <p>
                  Period: 
                  ${filters.dateFrom ? `From ${formatDate(parseISO(filters.dateFrom))}` : 'All time'}
                  ${filters.dateTo ? ` to ${formatDate(parseISO(filters.dateTo))}` : ' to Present'}
                </p>
                <p>Total Hours: ${totalHours.toFixed(2)} | Billable: ${totalBillableHours.toFixed(2)} | Non-Billable: ${totalNonBillableHours.toFixed(2)}</p>
              </div>
            </div>
            <table>
              <thead>
                <tr>
                  <th>${filters.groupBy.charAt(0).toUpperCase() + filters.groupBy.slice(1)}</th>
                  <th>Total Hours</th>
                  <th>Billable Hours</th>
                  <th>Non-Billable Hours</th>
                  <th>Percentage</th>
                </tr>
              </thead>
              <tbody>
                ${reportData.map(item => `
                  <tr>
                    <td>${item.name}</td>
                    <td>${item.value.toFixed(2)}</td>
                    <td>${item.billableHours.toFixed(2)}</td>
                    <td>${item.nonBillableHours.toFixed(2)}</td>
                    <td>${((item.value / totalHours) * 100).toFixed(1)}%</td>
                  </tr>
                `).join('')}
                <tr class="total-row">
                  <td>Total</td>
                  <td>${totalHours.toFixed(2)}</td>
                  <td>${totalBillableHours.toFixed(2)}</td>
                  <td>${totalNonBillableHours.toFixed(2)}</td>
                  <td>100%</td>
                </tr>
              </tbody>
            </table>
            <button onclick="window.print()">Print</button>
          </body>
        </html>
      `)
      
      printWindow.document.close()
      
      // Automatically trigger print dialog
      setTimeout(() => {
        printWindow.print()
      }, 500)
    } catch (error) {
      console.error('Error printing report:', error)
      alert('Failed to print report. Please check console for details.')
    }
  }

  // Filter projects based on selected customer
  const filteredProjects = filters.customer
    ? projects.filter(project => project.customer_id === filters.customer)
    : projects

  // Toggle debug mode
  const toggleDebugMode = () => {
    setDebugMode(!debugMode)
    if (!debugMode && !databaseState) {
      fetchDatabaseState()
    }
  }

  // Fix remaining time entries without customer attribution
  const fixCustomerAttribution = async () => {
    try {
      setLoading(true)
      
      // Get the "Det Mindre Bureau" customer ID for this user
      const { data: customer, error: customerError } = await supabase
        .from('customers')
        .select('id')
        .eq('user_id', user?.id)
        .eq('name', 'Det Mindre Bureau')
        .single()

      if (customerError || !customer) {
        throw new Error('Could not find Det Mindre Bureau customer')
      }

      // Update any remaining time entries without customer_id
      const { error: updateError } = await supabase
        .from('time_entries')
        .update({ customer_id: customer.id })
        .eq('user_id', user?.id)
        .is('customer_id', null)

      if (updateError) throw updateError

      // Refresh data
      await fetchTimeEntries()
      await fetchDatabaseState()
      
      alert('Fixed customer attribution for remaining time entries.')
      
    } catch (error: any) {
      console.error('Error fixing customer attribution:', error)
      alert(`Failed to fix customer attribution: ${error.message}`)
    } finally {
      setLoading(false)
    }
  }

  // Create sample data for testing
  const createSampleData = async () => {
    try {
      setLoading(true)
      
      // First, ensure we have a customer
      let customerId = ''
      const { data: existingCustomers } = await supabase
        .from('customers')
        .select('id')
        .eq('user_id', user?.id)
        .limit(1)
      
      if (existingCustomers && existingCustomers.length > 0) {
        customerId = existingCustomers[0].id
      } else {
        // Create a customer if none exists
        const { data: newCustomer, error: customerError } = await supabase
          .from('customers')
          .insert({
            user_id: user?.id,
            name: 'Sample Customer',
            email: 'sample@example.com'
          })
          .select('id')
          .single()
        
        if (customerError) throw customerError
        customerId = newCustomer.id
      }
      
      // Create a project
      const { data: newProject, error: projectError } = await supabase
        .from('projects')
        .insert({
          user_id: user?.id,
          customer_id: customerId,
          name: 'Sample Project',
          description: 'A sample project for testing'
        })
        .select('id')
        .single()
      
      if (projectError) throw projectError
      
      // Create a task
      const { data: task, error: taskError } = await supabase
        .from('tasks')
        .insert({
          user_id: user?.id,
          name: 'Sample Task',
          description: 'A sample task for testing'
        })
        .select('id')
        .single()
      
      if (taskError) throw taskError
      
      // Create time entries for the past week with billable/non-billable mix
      const today = new Date()
      const entries = []
      
      // Create entries for the last 7 days
      for (let i = 0; i < 7; i++) {
        const date = new Date()
        date.setDate(today.getDate() - i)
        
        // Create 1-3 entries per day
        const entriesPerDay = Math.floor(Math.random() * 3) + 1
        
        for (let j = 0; j < entriesPerDay; j++) {
          // Randomly choose between duration-based and time-based entries
          const useDuration = Math.random() > 0.5
          // 70% chance of being billable
          const isBillable = Math.random() > 0.3
          
          if (useDuration) {
            // Duration-based entry (30 min to 4 hours)
            const durationMinutes = Math.floor(Math.random() * 210) + 30
            
            entries.push({
              user_id: user?.id,
              task_id: task.id,
              customer_id: customerId, // Direct customer relationship
              date: format(date, 'yyyy-MM-dd'),
              duration_minutes: durationMinutes,
              billable: isBillable,
              description: `Sample ${isBillable ? 'billable' : 'non-billable'} work item ${j+1} for ${formatDate(date, 'dd MMM')}`
            })
          } else {
            // Time-based entry
            const startHour = 9 + Math.floor(Math.random() * 8) // Between 9 AM and 5 PM
            const durationHours = Math.random() * 3 + 0.5 // 0.5 to 3.5 hours
            
            const startTime = new Date(date)
            startTime.setHours(startHour, 0, 0, 0)
            
            const endTime = new Date(startTime)
            endTime.setHours(startTime.getHours() + Math.floor(durationHours))
            endTime.setMinutes((durationHours % 1) * 60)
            
            entries.push({
              user_id: user?.id,
              task_id: task.id,
              customer_id: customerId, // Direct customer relationship
              start_time: startTime.toISOString(),
              end_time: endTime.toISOString(),
              billable: isBillable,
              description: `Sample ${isBillable ? 'billable' : 'non-billable'} time entry ${j+1} for ${formatDate(date, 'dd MMM')}`
            })
          }
        }
      }
      
      // Insert all time entries
      const { error: entriesError } = await supabase
        .from('time_entries')
        .insert(entries)
      
      if (entriesError) throw entriesError
      
      // Refresh data
      await fetchTimeEntries()
      await fetchCustomers()
      await fetchProjects()
      
      alert('Sample data created successfully with direct customer relationships.')
      
    } catch (error: any) {
      console.error('Error creating sample data:', error)
      alert(`Failed to create sample data: ${error.message}`)
    } finally {
      setLoading(false)
    }
  }

  const billablePercentage = totalHours > 0 ? Math.round((totalBillableHours / totalHours) * 100) : 0

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-4 sm:mb-0">Reports</h1>
        <div className="flex flex-wrap gap-2">
          {!debugMode && (
            <button
              onClick={toggleDebugMode}
              className="btn btn-secondary flex items-center justify-center"
            >
              <FiAlertCircle className="mr-2" /> Debug
            </button>
          )}
          {debugMode && (
            <button
              onClick={toggleDebugMode}
              className="btn btn-secondary flex items-center justify-center"
            >
              <FiAlertCircle className="mr-2" /> Hide Debug
            </button>
          )}
          <button
            onClick={openFilterModal}
            className="btn btn-secondary flex items-center justify-center"
          >
            <FiFilter className="mr-2" /> Filters
          </button>
          <button
            onClick={exportCSV}
            className="btn btn-secondary flex items-center justify-center"
            disabled={reportData.length === 0}
          >
            <FiDownload className="mr-2" /> Export CSV
          </button>
          <button
            onClick={exportPDF}
            className="btn btn-secondary flex items-center justify-center"
            disabled={reportData.length === 0}
          >
            <FiFileText className="mr-2" /> Export PDF
          </button>
          <button
            onClick={printReport}
            className="btn btn-primary flex items-center justify-center"
            disabled={reportData.length === 0}
          >
            <FiPrinter className="mr-2" /> Print
          </button>
        </div>
      </div>

      {/* Debug Panel */}
      {debugMode && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-6">
          <h2 className="text-lg font-semibold text-red-800 dark:text-red-400 mb-2 flex items-center">
            <FiAlertCircle className="mr-2" /> Debug Information
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <h3 className="font-medium text-red-700 dark:text-red-300">Data Stats:</h3>
              <ul className="list-disc list-inside text-sm text-red-600 dark:text-red-300">
                <li>Total Time Entries: {debugInfo.timeEntriesCount}</li>
                <li>Filtered Entries: {debugInfo.filteredEntriesCount}</li>
                <li>Report Data Items: {debugInfo.reportDataCount}</li>
                <li>Client Summaries: {clientSummaries.length}</li>
                <li>Component Renders: {debugInfo.renderCount}</li>
              </ul>
            </div>
            <div>
              <h3 className="font-medium text-red-700 dark:text-red-300">Current Filters:</h3>
              <ul className="list-disc list-inside text-sm text-red-600 dark:text-red-300">
                <li>Date Range: {filters.dateFrom || 'All'} to {filters.dateTo || 'Present'}</li>
                <li>Customer: {filters.customer ? customers.find(c => c.id === filters.customer)?.name : 'All'}</li>
                <li>Project: {filters.project ? projects.find(p => p.id === filters.project)?.name : 'All'}</li>
                <li>Group By: {filters.groupBy}</li>
                <li>Billable Only: {filters.billableOnly ? 'Yes' : 'No'}</li>
              </ul>
            </div>
          </div>
          
          <div className="mb-4">
            <h3 className="font-medium text-red-700 dark:text-red-300">Client Debug Info:</h3>
            <ul className="list-disc list-inside text-sm text-red-600 dark:text-red-300">
              <li>Total Entries: {debugInfo.clientDebug.totalEntries}</li>
              <li>Entries with Customer: {debugInfo.clientDebug.entriesWithCustomer}</li>
              <li>Entries without Customer: {debugInfo.clientDebug.entriesWithoutCustomer}</li>
              <li>Unique Customers: {debugInfo.clientDebug.uniqueCustomers.join(', ')}</li>
              <li>Customer Breakdown: {JSON.stringify(debugInfo.clientDebug.customerBreakdown)}</li>
            </ul>
          </div>

          {/* Database State Information */}
          {databaseState && (
            <div className="mb-4">
              <h3 className="font-medium text-red-700 dark:text-red-300">Database State:</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-2">
                <div>
                  <h4 className="font-medium text-red-600 dark:text-red-400">Customers ({databaseState.totalCustomers}):</h4>
                  <ul className="list-disc list-inside text-xs text-red-600 dark:text-red-300">
                    {databaseState.customersWithProjects.map(customer => (
                      <li key={customer.id}>
                        {customer.name} ({customer.projectCount} projects)
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <h4 className="font-medium text-red-600 dark:text-red-400">Projects ({databaseState.totalProjects}):</h4>
                  <ul className="list-disc list-inside text-xs text-red-600 dark:text-red-300">
                    {databaseState.projectsWithTasks.map(project => (
                      <li key={project.id}>
                        {project.name} - {project.customerName} ({project.taskCount} tasks)
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <h4 className="font-medium text-red-600 dark:text-red-400">Tasks ({databaseState.totalTasks}):</h4>
                  <ul className="list-disc list-inside text-xs text-red-600 dark:text-red-300">
                    {databaseState.tasksWithEntries.map(task => (
                      <li key={task.id}>
                        {task.name} - {task.customerName} ({task.entryCount} entries)
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          )}
          
          <div className="flex flex-wrap gap-2">
            <button
              onClick={fixCustomerAttribution}
              className="px-3 py-1 bg-green-100 hover:bg-green-200 text-green-800 text-sm rounded"
            >
              Fix Customer Attribution
            </button>
            <button
              onClick={createSampleData}
              className="px-3 py-1 bg-red-100 hover:bg-red-200 text-red-800 text-sm rounded"
            >
              Create Sample Data
            </button>
            <button
              onClick={fetchTimeEntries}
              className="px-3 py-1 bg-red-100 hover:bg-red-200 text-red-800 text-sm rounded"
            >
              Reload Data
            </button>
            <button
              onClick={() => setDateRange('allTime')}
              className="px-3 py-1 bg-red-100 hover:bg-red-200 text-red-800 text-sm rounded"
            >
              Show All Time
            </button>
            <button
              onClick={fetchDatabaseState}
              className="px-3 py-1 bg-red-100 hover:bg-red-200 text-red-800 text-sm rounded"
            >
              Check Database State
            </button>
          </div>
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white dark:bg-gray-800 shadow-md rounded-lg p-4">
          <div className="flex items-center">
            <FiClock className="h-8 w-8 text-blue-500" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Total Hours</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{totalHours.toFixed(1)}</p>
            </div>
          </div>
        </div>
        
        <div className="bg-white dark:bg-gray-800 shadow-md rounded-lg p-4">
          <div className="flex items-center">
            <FiDollarSign className="h-8 w-8 text-green-500" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Billable Hours</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{totalBillableHours.toFixed(1)}</p>
            </div>
          </div>
        </div>
        
        <div className="bg-white dark:bg-gray-800 shadow-md rounded-lg p-4">
          <div className="flex items-center">
            <FiClock className="h-8 w-8 text-orange-500" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Non-Billable Hours</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{totalNonBillableHours.toFixed(1)}</p>
            </div>
          </div>
        </div>
        
        <div className="bg-white dark:bg-gray-800 shadow-md rounded-lg p-4">
          <div className="flex items-center">
            <FiBarChart2 className="h-8 w-8 text-purple-500" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Billable %</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{billablePercentage}%</p>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Date Filters */}
      <div className="bg-white dark:bg-gray-800 shadow-md rounded-lg p-4 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Quick Date Range</h2>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setDateRange('today')}
            className={`px-3 py-1 rounded-md text-sm ${
              filters.dateFrom === format(new Date(), 'yyyy-MM-dd') && 
              filters.dateTo === format(new Date(), 'yyyy-MM-dd')
                ? 'bg-primary-100 text-primary-800 dark:bg-primary-900/20 dark:text-primary-400'
                : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
            }`}
          >
            Today
          </button>
          <button
            onClick={() => setDateRange('thisWeek')}
            className={`px-3 py-1 rounded-md text-sm ${
              filters.dateFrom === format(startOfWeek(new Date()), 'yyyy-MM-dd') && 
              filters.dateTo === format(endOfWeek(new Date()), 'yyyy-MM-dd')
                ? 'bg-primary-100 text-primary-800 dark:bg-primary-900/20 dark:text-primary-400'
                : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
            }`}
          >
            This Week
          </button>
          <button
            onClick={() => setDateRange('thisMonth')}
            className={`px-3 py-1 rounded-md text-sm ${
              filters.dateFrom === format(startOfMonth(new Date()), 'yyyy-MM-dd') && 
              filters.dateTo === format(endOfMonth(new Date()), 'yyyy-MM-dd')
                ? 'bg-primary-100 text-primary-800 dark:bg-primary-900/20 dark:text-primary-400'
                : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
            }`}
          >
            This Month
          </button>
          <button
            onClick={() => setDateRange('lastMonth')}
            className={`px-3 py-1 rounded-md text-sm bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600`}
          >
            Last Month
          </button>
          <button
            onClick={() => setDateRange('allTime')}
            className={`px-3 py-1 rounded-md text-sm ${
              !filters.dateFrom && !filters.dateTo
                ? 'bg-primary-100 text-primary-800 dark:bg-primary-900/20 dark:text-primary-400'
                : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
            }`}
          >
            All Time
          </button>
        </div>
        
        <div className="mt-4 flex flex-col sm:flex-row sm:items-center text-sm text-gray-600 dark:text-gray-400">
          <div className="flex items-center mb-2 sm:mb-0 sm:mr-4">
            <FiCalendar className="mr-1" />
            <span>
              {filters.dateFrom 
                ? `From: ${formatDate(parseISO(filters.dateFrom))}` 
                : 'From: All time'}
            </span>
          </div>
          <div className="flex items-center mb-2 sm:mb-0 sm:mr-4">
            <FiCalendar className="mr-1" />
            <span>
              {filters.dateTo 
                ? `To: ${formatDate(parseISO(filters.dateTo))}` 
                : 'To: Present'}
            </span>
          </div>
          <div className="flex items-center">
            <FiClock className="mr-1" />
            <span>Total: {totalHours} hours ({billablePercentage}% billable)</span>
          </div>
        </div>
      </div>

      {/* Period Summaries */}
      <div className="bg-white dark:bg-gray-800 shadow-md rounded-lg p-4 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Hours by Period</h2>
          <div className="flex gap-2">
            <button
              onClick={() => setSelectedPeriodView('week')}
              className={`px-3 py-1 rounded-md text-sm ${
                selectedPeriodView === 'week'
                  ? 'bg-primary-100 text-primary-800 dark:bg-primary-900/20 dark:text-primary-400'
                  : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              Weekly
            </button>
            <button
              onClick={() => setSelectedPeriodView('month')}
              className={`px-3 py-1 rounded-md text-sm ${
                selectedPeriodView === 'month'
                  ? 'bg-primary-100 text-primary-800 dark:bg-primary-900/20 dark:text-primary-400'
                  : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              Monthly
            </button>
            <button
              onClick={() => setSelectedPeriodView('quarter')}
              className={`px-3 py-1 rounded-md text-sm ${
                selectedPeriodView === 'quarter'
                  ? 'bg-primary-100 text-primary-800 dark:bg-primary-900/20 dark:text-primary-400'
                  : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              Quarterly
            </button>
          </div>
        </div>
        
        {periodSummaries.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Period
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Total Hours
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Billable Hours
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Non-Billable Hours
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Billable %
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {periodSummaries.map((summary, index) => (
                  <tr key={index} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                      {summary.period}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300 text-right">
                      {summary.totalHours.toFixed(2)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-green-600 dark:text-green-400 text-right">
                      {summary.billableHours.toFixed(2)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-orange-600 dark:text-orange-400 text-right">
                      {summary.nonBillableHours.toFixed(2)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300 text-right">
                      {summary.billablePercentage}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-gray-500 dark:text-gray-400 text-center py-4">No data available for the selected period.</p>
        )}
      </div>

      {/* Client Overview */}
      <div className="bg-white dark:bg-gray-800 shadow-md rounded-lg p-4 mb-6">
        <div className="flex items-center mb-4">
          <FiUsers className="mr-2 text-primary-600" />
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Client Overview</h2>
          <span className="ml-2 text-sm text-gray-500 dark:text-gray-400">(All Time Data)</span>
        </div>
        
        {clientSummaries.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Client
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Total Hours
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Billable Hours
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Non-Billable Hours
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Billable Amount
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {clientSummaries.map((client) => (
                  <tr key={client.clientId} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                      {client.clientName}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300 text-right">
                      {client.totalHours.toFixed(2)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-green-600 dark:text-green-400 text-right">
                      {client.billableHours.toFixed(2)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-orange-600 dark:text-orange-400 text-right">
                      {client.nonBillableHours.toFixed(2)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white text-right font-medium">
                      {formatCurrency(client.billableAmount)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <button
                        onClick={() => {
                          setFilters(prev => ({ ...prev, customer: client.clientId }))
                        }}
                        className="text-primary-600 hover:text-primary-900 dark:text-primary-400 dark:hover:text-primary-300 text-sm font-medium"
                      >
                        Filter for Invoice
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-gray-500 dark:text-gray-400 text-center py-4">No client data available.</p>
        )}
      </div>

      <div ref={reportRef}>
        {loading ? (
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-600"></div>
          </div>
        ) : reportData.length > 0 ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Bar Chart */}
            <div className="bg-white dark:bg-gray-800 shadow-md rounded-lg p-4">
              <div className="flex items-center mb-4">
                <FiBarChart2 className="mr-2 text-primary-600" />
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Time by {filters.groupBy.charAt(0).toUpperCase() + filters.groupBy.slice(1)}
                </h2>
              </div>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={reportData}
                    margin={{ top: 20, right: 30, left: 20, bottom: 60 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="name" 
                      angle={-45} 
                      textAnchor="end" 
                      height={70}
                      tick={{ fontSize: 12 }}
                    />
                    <YAxis 
                      label={{ 
                        value: 'Hours', 
                        angle: -90, 
                        position: 'insideLeft',
                        style: { textAnchor: 'middle' }
                      }} 
                    />
                    <Tooltip 
                      formatter={(value: number, name: string) => {
                        if (name === 'Billable Hours') return [`${value} hours`, 'Billable']
                        if (name === 'Non-Billable Hours') return [`${value} hours`, 'Non-Billable']
                        return [`${value} hours`, 'Total']
                      }}
                      labelFormatter={(label) => `${filters.groupBy.charAt(0).toUpperCase() + filters.groupBy.slice(1)}: ${label}`}
                    />
                    <Legend />
                    <Bar dataKey="billableHours" name="Billable Hours" fill="#10b981" />
                    <Bar dataKey="nonBillableHours" name="Non-Billable Hours" fill="#f59e0b" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
            
            {/* Pie Chart */}
            <div className="bg-white dark:bg-gray-800 shadow-md rounded-lg p-4">
              <div className="flex items-center mb-4">
                <FiPieChart className="mr-2 text-primary-600" />
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Billable vs Non-Billable Distribution
                </h2>
              </div>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={[
                        { name: 'Billable Hours', value: totalBillableHours, fill: '#10b981' },
                        { name: 'Non-Billable Hours', value: totalNonBillableHours, fill: '#f59e0b' }
                      ]}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      outerRadius={80}
                      dataKey="value"
                      label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                    />
                    <Tooltip 
                      formatter={(value: number) => [`${value.toFixed(2)} hours`, 'Time']}
                    />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
            
            {/* Data Table */}
            <div className="bg-white dark:bg-gray-800 shadow-md rounded-lg p-4 lg:col-span-2">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Time Summary
              </h2>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                  <thead className="bg-gray-50 dark:bg-gray-700">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        {filters.groupBy.charAt(0).toUpperCase() + filters.groupBy.slice(1)}
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        Total Hours
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        Billable Hours
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        Non-Billable Hours
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        Percentage
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                    {reportData.map((item, index) => (
                      <tr key={index} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                          {item.name}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300 text-right">
                          {item.value.toFixed(2)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-green-600 dark:text-green-400 text-right">
                          {item.billableHours.toFixed(2)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-orange-600 dark:text-orange-400 text-right">
                          {item.nonBillableHours.toFixed(2)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300 text-right">
                          {((item.value / totalHours) * 100).toFixed(1)}%
                        </td>
                      </tr>
                    ))}
                    <tr className="bg-gray-50 dark:bg-gray-700">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900 dark:text-white">
                        Total
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900 dark:text-white text-right">
                        {totalHours.toFixed(2)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-green-600 dark:text-green-400 text-right">
                        {totalBillableHours.toFixed(2)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-orange-600 dark:text-orange-400 text-right">
                        {totalNonBillableHours.toFixed(2)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900 dark:text-white text-right">
                        100%
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-white dark:bg-gray-800 shadow-md rounded-lg p-6 text-center">
            <p className="text-gray-500 dark:text-gray-400 mb-4">
              No time entries found for the selected filters.
            </p>
            {debugMode && (
              <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded text-left">
                <p className="text-red-700 dark:text-red-300 text-sm mb-2">Debugging Information:</p>
                <ul className="list-disc list-inside text-sm text-red-600 dark:text-red-300">
                  <li>Total Time Entries: {debugInfo.timeEntriesCount}</li>
                  <li>Filtered Entries: {debugInfo.filteredEntriesCount}</li>
                  <li>Current Filters: {JSON.stringify(filters)}</li>
                </ul>
                <div className="flex flex-wrap gap-2 mt-2">
                  <button
                    onClick={createSampleData}
                    className="px-3 py-1 bg-red-100 hover:bg-red-200 text-red-800 text-sm rounded"
                  >
                    Create Sample Data
                  </button>
                  <button
                    onClick={() => setDateRange('allTime')}
                    className="px-3 py-1 bg-red-100 hover:bg-red-200 text-red-800 text-sm rounded"
                  >
                    Show All Time
                  </button>
                </div>
              </div>
            )}
            <button
              onClick={openFilterModal}
              className="btn btn-secondary"
            >
              Adjust Filters
            </button>
          </div>
        )}
      </div>

      {/* Filter Modal */}
      {isFilterModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 transition-opacity" onClick={closeFilterModal}>
              <div className="absolute inset-0 bg-gray-500 dark:bg-gray-900 opacity-75"></div>
            </div>
            <span className="hidden sm:inline-block sm:align-middle sm:h-screen">&#8203;</span>
            <div className="inline-block align-bottom bg-white dark:bg-gray-800 rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
              <div className="bg-white dark:bg-gray-800 px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
                  Report Filters
                </h3>
                
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="dateFrom" className="label">
                        From Date
                      </label>
                      <div className="relative">
                        <input
                          type="date"
                          id="dateFrom"
                          name="dateFrom"
                          value={filters.dateFrom}
                          onChange={handleFilterChange}
                          className="input pl-10"
                        />
                        <FiCalendar className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                      </div>
                    </div>
                    
                    <div>
                      <label htmlFor="dateTo" className="label">
                        To Date
                      </label>
                      <div className="relative">
                        <input
                          type="date"
                          id="dateTo"
                          name="dateTo"
                          value={filters.dateTo}
                          onChange={handleFilterChange}
                          className="input pl-10"
                        />
                        <FiCalendar className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                      </div>
                    </div>
                  </div>
                  
                  <div>
                    <label htmlFor="customer" className="label">
                      Customer
                    </label>
                    <select
                      id="customer"
                      name="customer"
                      value={filters.customer}
                      onChange={handleFilterChange}
                      className="input"
                    >
                      <option value="">All Customers</option>
                      {customers.map(customer => (
                        <option key={customer.id} value={customer.id}>
                          {customer.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  
                  <div>
                    <label htmlFor="project" className="label">
                      Project
                    </label>
                    <select
                      id="project"
                      name="project"
                      value={filters.project}
                      onChange={handleFilterChange}
                      className="input"
                      disabled={!filters.customer}
                    >
                      <option value="">All Projects</option>
                      {filteredProjects.map(project => (
                        <option key={project.id} value={project.id}>
                          {project.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  
                  <div>
                    <label htmlFor="groupBy" className="label">
                      Group By
                    </label>
                    <select
                      id="groupBy"
                      name="groupBy"
                      value={filters.groupBy}
                      onChange={handleFilterChange}
                      className="input"
                    >
                      <option value="customer">Customer</option>
                      <option value="project">Project</option>
                      <option value="task">Task</option>
                      <option value="day">Day</option>
                    </select>
                  </div>

                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="billableOnly"
                      name="billableOnly"
                      checked={filters.billableOnly}
                      onChange={handleFilterChange}
                      className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                    />
                    <label htmlFor="billableOnly" className="ml-2 block text-sm text-gray-900 dark:text-white">
                      Show billable hours only
                    </label>
                  </div>
                </div>
                
                <div className="flex justify-end space-x-2 mt-6">
                  <button
                    type="button"
                    onClick={closeFilterModal}
                    className="btn btn-secondary"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={applyFilters}
                    className="btn btn-primary"
                  >
                    Apply Filters
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
