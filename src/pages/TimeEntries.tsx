import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { FiPause, FiEdit2, FiTrash2, FiSearch, FiX, FiFilter, FiCalendar, FiPlus, FiClock, FiDollarSign, FiToggleRight, FiChevronRight } from 'react-icons/fi'
import { format, parseISO, differenceInSeconds, startOfDay, startOfMonth, endOfMonth, subMonths, isAfter, isBefore, isEqual } from 'date-fns'
import { formatDate, formatCurrency, startOfWeek, endOfWeek, formatMonthYear } from '../utils/localization'

interface Task {
  id: string
  name: string
}

interface Project {
  id: string
  name: string
  customer_id: string
}

interface Customer {
  id: string
  name: string
}

interface TimeEntry {
  id: string
  task_id: string
  project_id: string | null
  customer_id: string | null
  date: string
  duration_minutes: number | null
  start_time: string | null
  end_time: string | null
  description: string
  billable: boolean
  active: boolean
  rate: number | null
  created_at: string
  task?: Task
  project?: Project
  customer?: Customer
}

interface TimeHighlight {
  period: string;
  hours: number;
  icon: JSX.Element;
  color: string;
  dateRange: string;
}

export default function TimeEntries() {
  const { user } = useAuth()
  const [timeEntries, setTimeEntries] = useState<TimeEntry[]>([])
  const [tasks, setTasks] = useState<Task[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTimer, setActiveTimer] = useState<TimeEntry | null>(null)
  const [elapsedTime, setElapsedTime] = useState(0)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
  const [currentTimeEntry, setCurrentTimeEntry] = useState<TimeEntry | null>(null)
  const [formData, setFormData] = useState({
    task_id: '',
    project_id: '',
    customer_id: '',
    date: '',
    duration_hours: '',
    duration_minutes: '',
    description: '',
    billable: true,
    active: true,
    rate: ''
  })
  const [searchQuery, setSearchQuery] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [filters, setFilters] = useState({
    task: '',
    project: '',
    customer: '',
    dateFrom: '',
    dateTo: '',
    billable: '',
    active: ''
  })
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false)
  const [expandedEntryId, setExpandedEntryId] = useState<string | null>(null)
  const [timeHighlights, setTimeHighlights] = useState<TimeHighlight[]>([
    { period: 'Today', hours: 0, icon: <FiClock />, color: 'bg-blue-500', dateRange: formatDate(new Date(), 'dd MMM') },
    { period: 'This Week', hours: 0, icon: <FiClock />, color: 'bg-green-500', dateRange: `${formatDate(startOfWeek(new Date()), 'dd MMM')} - ${formatDate(new Date(), 'dd MMM')}` },
    { period: 'This Month', hours: 0, icon: <FiCalendar />, color: 'bg-purple-500', dateRange: formatMonthYear(new Date()) },
    { period: 'Last Month', hours: 0, icon: <FiCalendar />, color: 'bg-orange-500', dateRange: formatMonthYear(subMonths(new Date(), 1)) }
  ])

  useEffect(() => {
    if (!user) return
    fetchTimeEntries()
    fetchTasks()
    fetchProjects()
    fetchCustomers()
  }, [user])

  useEffect(() => {
    // Set up timer for active time entry
    const timerInterval = setInterval(() => {
      if (activeTimer) {
        setElapsedTime(prev => prev + 1)
      }
    }, 1000)
    
    return () => clearInterval(timerInterval)
  }, [activeTimer])

  const fetchTimeEntries = async () => {
    try {
      setLoading(true)
      
      // First check if there's an active timer
      const { data: activeTimerData, error: activeTimerError } = await supabase
        .from('time_entries')
        .select(`
          *,
          task:tasks(
            id,
            name
          ),
          project:projects(
            id,
            name,
            customer_id
          ),
          customer:customers(
            id,
            name
          )
        `)
        .eq('user_id', user?.id)
        .is('end_time', null)
        .not('start_time', 'is', null)
        .single()
      
      if (activeTimerError && activeTimerError.code !== 'PGRST116') {
        console.error('Error fetching active timer:', activeTimerError)
      }
      
      if (activeTimerData) {
        setActiveTimer(activeTimerData)
        const startTime = new Date(activeTimerData.start_time || '')
        const elapsed = differenceInSeconds(new Date(), startTime)
        setElapsedTime(elapsed)
      } else {
        setActiveTimer(null)
        setElapsedTime(0)
      }
      
      // Then fetch all time entries
      let query = supabase
        .from('time_entries')
        .select(`
          *,
          task:tasks(
            id,
            name
          ),
          project:projects(
            id,
            name,
            customer_id
          ),
          customer:customers(
            id,
            name
          )
        `)
        .eq('user_id', user?.id)
        .order('created_at', { ascending: false })
      
      const { data, error } = await query
      
      if (error) {
        console.error('Error fetching time entries:', error)
        throw error
      }
      
      setTimeEntries(data || [])
      
      // Calculate time highlights
      calculateTimeHighlights(data || [])
    } catch (error: any) {
      console.error('Error fetching time entries:', error.message)
    } finally {
      setLoading(false)
    }
  }

  const calculateTimeHighlights = (entries: TimeEntry[]) => {
    // Define time periods
    const today = startOfDay(new Date())
    const thisWeekStart = startOfWeek(new Date())
    const thisMonthStart = startOfMonth(new Date())
    const thisMonthEnd = endOfMonth(new Date())
    const lastMonthStart = startOfMonth(subMonths(new Date(), 1))
    const lastMonthEnd = endOfMonth(subMonths(new Date(), 1))

    // Helper function to safely parse dates
    const getEntryDate = (entry: TimeEntry): Date | null => {
      try {
        if (entry.date) {
          return parseISO(entry.date)
        } else if (entry.start_time) {
          return parseISO(entry.start_time)
        } else if (entry.created_at) {
          return parseISO(entry.created_at)
        }
        return null
      } catch (e) {
        console.error('Error parsing date:', e)
        return null
      }
    }

    // Helper function to check if a date is within a range
    const isDateInRange = (date: Date | null, start: Date, end?: Date): boolean => {
      if (!date) return false
      
      if (end) {
        return (isAfter(date, start) || isEqual(date, start)) && 
              (isBefore(date, end) || isEqual(date, end))
      }
      
      return isAfter(date, start) || isEqual(date, start)
    }

    // Filter entries by date client-side
    const todayEntries = entries.filter(entry => {
      const entryDate = getEntryDate(entry)
      return isDateInRange(entryDate, today)
    })

    const thisWeekEntries = entries.filter(entry => {
      const entryDate = getEntryDate(entry)
      return isDateInRange(entryDate, thisWeekStart)
    })

    const thisMonthEntries = entries.filter(entry => {
      const entryDate = getEntryDate(entry)
      return isDateInRange(entryDate, thisMonthStart, thisMonthEnd)
    })

    const lastMonthEntries = entries.filter(entry => {
      const entryDate = getEntryDate(entry)
      return isDateInRange(entryDate, lastMonthStart, lastMonthEnd)
    })

    // Calculate total hours for each period
    const calculateTotalHours = (entries: TimeEntry[]): number => {
      if (!entries || entries.length === 0) return 0
      
      let totalMinutes = 0
      
      for (const entry of entries) {
        // Try duration_minutes first
        if (entry.duration_minutes !== null && entry.duration_minutes !== undefined) {
          const minutes = parseFloat(String(entry.duration_minutes))
          if (!isNaN(minutes)) {
            totalMinutes += minutes
            continue
          }
        }
        
        // Finally try calculating from start/end time
        if (entry.start_time && entry.end_time) {
          try {
            const start = parseISO(entry.start_time)
            const end = parseISO(entry.end_time)
            const diffMs = end.getTime() - start.getTime()
            const diffMinutes = Math.floor(diffMs / 60000)
            if (diffMinutes > 0) {
              totalMinutes += diffMinutes
            }
          } catch (e) {
            console.error('Error calculating duration from timestamps:', e)
          }
        }
      }
      
      return Math.round((totalMinutes / 60) * 10) / 10 // Convert minutes to hours with 1 decimal place
    }

    // Update time highlights with calculated hours
    setTimeHighlights([
      { 
        period: 'Today', 
        hours: calculateTotalHours(todayEntries), 
        icon: <FiClock />, 
        color: 'bg-blue-500',
        dateRange: formatDate(new Date(), 'dd MMM')
      },
      { 
        period: 'This Week', 
        hours: calculateTotalHours(thisWeekEntries), 
        icon: <FiClock />, 
        color: 'bg-green-500',
        dateRange: `${formatDate(startOfWeek(new Date()), 'dd MMM')} - ${formatDate(new Date(), 'dd MMM')}`
      },
      { 
        period: 'This Month', 
        hours: calculateTotalHours(thisMonthEntries), 
        icon: <FiCalendar />, 
        color: 'bg-purple-500',
        dateRange: formatMonthYear(new Date())
      },
      { 
        period: 'Last Month', 
        hours: calculateTotalHours(lastMonthEntries), 
        icon: <FiCalendar />, 
        color: 'bg-orange-500',
        dateRange: formatMonthYear(subMonths(new Date(), 1))
      }
    ])
  }

  const fetchTasks = async () => {
    try {
      const { data, error } = await supabase
        .from('tasks')
        .select(`
          id,
          name
        `)
        .eq('user_id', user?.id)
        .order('name')
      
      if (error) throw error
      
      setTasks(data || [])
    } catch (error: any) {
      console.error('Error fetching tasks:', error.message)
    }
  }

  const fetchProjects = async () => {
    try {
      const { data, error } = await supabase
        .from('projects')
        .select(`
          id,
          name,
          customer_id
        `)
        .eq('user_id', user?.id)
        .order('name')
      
      if (error) throw error
      
      setProjects(data || [])
    } catch (error: any) {
      console.error('Error fetching projects:', error.message)
    }
  }

  const fetchCustomers = async () => {
    try {
      const { data, error } = await supabase
        .from('customers')
        .select(`
          id,
          name
        `)
        .eq('user_id', user?.id)
        .order('name')
      
      if (error) throw error
      
      setCustomers(data || [])
    } catch (error: any) {
      console.error('Error fetching customers:', error.message)
    }
  }

  const openModal = (timeEntry: TimeEntry | null = null) => {
    setCurrentTimeEntry(timeEntry)
    
    if (timeEntry) {
      // Edit existing time entry
      const date = timeEntry.date || (timeEntry.start_time ? format(parseISO(timeEntry.start_time), 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd'))
      
      let durationHours = ''
      let durationMinutes = ''
      
      if (timeEntry.duration_minutes !== null) {
        // If we have duration_minutes, use that
        durationHours = Math.floor(timeEntry.duration_minutes / 60).toString()
        durationMinutes = (timeEntry.duration_minutes % 60).toString()
      } else if (timeEntry.start_time && timeEntry.end_time) {
        // Otherwise calculate from start/end if available
        const durationInSeconds = differenceInSeconds(new Date(timeEntry.end_time), new Date(timeEntry.start_time))
        const durationInMinutes = Math.floor(durationInSeconds / 60)
        durationHours = Math.floor(durationInMinutes / 60).toString()
        durationMinutes = (durationInMinutes % 60).toString()
      }
      
      setFormData({
        task_id: timeEntry.task_id,
        project_id: timeEntry.project_id || '',
        customer_id: timeEntry.customer_id || (timeEntry.project?.customer_id || ''),
        date,
        duration_hours: durationHours,
        duration_minutes: durationMinutes,
        description: timeEntry.description || '',
        billable: timeEntry.billable !== false, // Default to true if undefined
        active: timeEntry.active !== false, // Default to true if undefined
        rate: timeEntry.rate ? timeEntry.rate.toString() : ''
      })
    } else {
      // Create new time entry
      const today = format(new Date(), 'yyyy-MM-dd')
      
      setFormData({
        task_id: '',
        project_id: '',
        customer_id: '',
        date: today,
        duration_hours: '',
        duration_minutes: '',
        description: '',
        billable: true,
        active: true,
        rate: ''
      })
    }
    
    setIsModalOpen(true)
  }

  const closeModal = () => {
    setIsModalOpen(false)
    setError(null)
  }

  const openDeleteModal = (timeEntry: TimeEntry) => {
    setCurrentTimeEntry(timeEntry)
    setIsDeleteModalOpen(true)
  }

  const closeDeleteModal = () => {
    setIsDeleteModalOpen(false)
    setError(null)
  }

  const openFilterModal = () => {
    setIsFilterModalOpen(true)
  }

  const closeFilterModal = () => {
    setIsFilterModalOpen(false)
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  const handleCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, checked } = e.target
    setFormData(prev => ({ ...prev, [name]: checked }))
  }

  const handleCustomerChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const customerId = e.target.value
    setFormData(prev => ({ 
      ...prev, 
      customer_id: customerId,
      project_id: '', // Reset project when customer changes
      task_id: '' // Reset task when customer changes
    }))
  }

  const handleProjectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const projectId = e.target.value
    setFormData(prev => ({ 
      ...prev, 
      project_id: projectId,
      task_id: '' // Reset task when project changes
    }))
  }

  const handleFilterChange = (e: React.ChangeEvent<HTMLSelectElement | HTMLInputElement>) => {
    const { name, value } = e.target
    setFilters(prev => ({ ...prev, [name]: value }))
  }

  const applyFilters = () => {
    closeFilterModal()
    fetchTimeEntries()
  }

  const resetFilters = () => {
    setFilters({
      task: '',
      project: '',
      customer: '',
      dateFrom: '',
      dateTo: '',
      billable: '',
      active: ''
    })
    closeFilterModal()
    fetchTimeEntries()
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!formData.task_id) {
      setError('Please select a task')
      return
    }
    
    if (!formData.project_id) {
      setError('Please select a project')
      return
    }
    
    if (!formData.customer_id) {
      setError('Please select a customer')
      return
    }
    
    if (!formData.date) {
      setError('Date is required')
      return
    }
    
    const hours = parseInt(formData.duration_hours) || 0
    const minutes = parseInt(formData.duration_minutes) || 0
    
    if (hours === 0 && minutes === 0) {
      setError('Please enter a duration')
      return
    }
    
    const totalMinutes = (hours * 60) + minutes
    const rate = formData.rate ? parseFloat(formData.rate) : null
    
    try {
      setError(null)
      
      if (currentTimeEntry) {
        // Update existing time entry
        const { error } = await supabase
          .from('time_entries')
          .update({
            task_id: formData.task_id,
            project_id: formData.project_id,
            customer_id: formData.customer_id,
            date: formData.date,
            duration_minutes: totalMinutes,
            description: formData.description,
            billable: formData.billable,
            active: formData.active,
            rate: rate
          })
          .eq('id', currentTimeEntry.id)
        
        if (error) {
          console.error('Error updating time entry:', error)
          throw error
        }
      } else {
        // Create new time entry
        const { error } = await supabase
          .from('time_entries')
          .insert([
            {
              user_id: user?.id,
              task_id: formData.task_id,
              project_id: formData.project_id,
              customer_id: formData.customer_id,
              date: formData.date,
              duration_minutes: totalMinutes,
              description: formData.description,
              billable: formData.billable,
              active: formData.active,
              rate: rate
            }
          ])
        
        if (error) {
          console.error('Error creating time entry:', error)
          throw error
        }
      }
      
      closeModal()
      fetchTimeEntries()
    } catch (error: any) {
      console.error('Error in handleSubmit:', error)
      setError(error.message)
    }
  }

  const handleDelete = async () => {
    if (!currentTimeEntry) return
    
    try {
      const { error } = await supabase
        .from('time_entries')
        .delete()
        .eq('id', currentTimeEntry.id)
      
      if (error) throw error
      
      closeDeleteModal()
      fetchTimeEntries()
    } catch (error: any) {
      setError(error.message)
    }
  }

  const stopTimer = async () => {
    if (!activeTimer) return
    
    try {
      const endTime = new Date().toISOString()
      const startTime = activeTimer.start_time ? new Date(activeTimer.start_time) : new Date()
      const durationInSeconds = differenceInSeconds(new Date(endTime), startTime)
      const durationInMinutes = Math.ceil(durationInSeconds / 60)
      
      const { error } = await supabase
        .from('time_entries')
        .update({ 
          end_time: endTime,
          duration_minutes: durationInMinutes,
          date: format(startTime, 'yyyy-MM-dd')
        })
        .eq('id', activeTimer.id)
      
      if (error) throw error
      
      setActiveTimer(null)
      setElapsedTime(0)
      fetchTimeEntries()
    } catch (error: any) {
      console.error('Error stopping timer:', error.message)
    }
  }

  const formatElapsedTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    const secs = seconds % 60
    
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  const formatDuration = (durationMinutes: number | null, startTime?: string | null, endTime?: string | null) => {
    if (durationMinutes !== null) {
      const hours = Math.floor(durationMinutes / 60)
      const minutes = durationMinutes % 60
      return `${hours}h ${minutes}m`
    } else if (startTime && endTime) {
      const start = new Date(startTime)
      const end = new Date(endTime)
      const durationInSeconds = differenceInSeconds(end, start)
      const durationInMinutes = Math.floor(durationInSeconds / 60)
      const hours = Math.floor(durationInMinutes / 60)
      const minutes = durationInMinutes % 60
      return `${hours}h ${minutes}m`
    }
    return '-'
  }

  const toggleExpandEntry = (entryId: string) => {
    if (expandedEntryId === entryId) {
      setExpandedEntryId(null)
    } else {
      setExpandedEntryId(entryId)
    }
  }

  const filteredTimeEntries = timeEntries.filter(entry => {
    // Apply search query
    const matchesSearch = 
      (entry.task?.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (entry.project?.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (entry.customer?.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (entry.description || '').toLowerCase().includes(searchQuery.toLowerCase())
    
    // Apply filters
    let matchesFilters = true
    
    if (filters.task && entry.task_id !== filters.task) {
      matchesFilters = false
    }
    
    if (filters.project && entry.project_id !== filters.project) {
      matchesFilters = false
    }
    
    if (filters.customer && entry.customer_id !== filters.customer) {
      matchesFilters = false
    }
    
    if (filters.billable) {
      if (filters.billable === 'yes' && !entry.billable) {
        matchesFilters = false
      } else if (filters.billable === 'no' && entry.billable) {
        matchesFilters = false
      }
    }
    
    if (filters.active) {
      if (filters.active === 'yes' && !entry.active) {
        matchesFilters = false
      } else if (filters.active === 'no' && entry.active) {
        matchesFilters = false
      }
    }
    
    const entryDate = entry.date 
      ? new Date(entry.date) 
      : entry.start_time 
        ? new Date(entry.start_time) 
        : null
    
    if (filters.dateFrom && entryDate) {
      const fromDate = new Date(filters.dateFrom)
      fromDate.setHours(0, 0, 0, 0)
      
      if (entryDate < fromDate) {
        matchesFilters = false
      }
    }
    
    if (filters.dateTo && entryDate) {
      const toDate = new Date(filters.dateTo)
      toDate.setHours(23, 59, 59, 999)
      
      if (entryDate > toDate) {
        matchesFilters = false
      }
    }
    
    return matchesSearch && matchesFilters
  })

  // Get filtered projects based on selected customer
  const filteredProjects = formData.customer_id
    ? projects.filter(project => project.customer_id === formData.customer_id)
    : projects

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-4 sm:mb-0">Time Entries</h1>
        <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-2">
          <div className="relative">
            <input
              type="text"
              placeholder="Search entries..."
              className="input pl-10"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <FiX />
              </button>
            )}
          </div>
          <div className="flex space-x-2">
            <button
              onClick={openFilterModal}
              className="btn btn-secondary flex-1 sm:flex-none flex items-center justify-center"
              aria-label="Filter entries"
            >
              <FiFilter className="mr-2" /> Filter
            </button>
            <button
              onClick={() => openModal()}
              className="btn btn-primary flex-1 sm:flex-none flex items-center justify-center"
              aria-label="Add new time entry"
            >
              <FiPlus className="mr-2" /> New Entry
            </button>
          </div>
        </div>
      </div>

      {/* Time Highlights */}
      <div className="card p-4 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Time Highlights</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
          {timeHighlights.map((highlight) => (
            <div key={highlight.period} className="bg-white dark:bg-gray-800 rounded-lg p-3 md:p-4 shadow">
              <div className="flex items-center">
                <div className={`p-2 md:p-3 rounded-full ${highlight.color} text-white mr-2 md:mr-4 flex-shrink-0`}>
                  {highlight.icon}
                </div>
                <div className="min-w-0">
                  <p className="text-xs md:text-sm text-gray-500 dark:text-gray-400 truncate">{highlight.period}</p>
                  <p className="text-lg md:text-2xl font-semibold text-gray-900 dark:text-white">{highlight.hours} hrs</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{highlight.dateRange}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Active Timer */}
      {activeTimer && (
        <div className="bg-white dark:bg-gray-800 shadow-md rounded-lg p-4 mb-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between">
            <div className="mb-4 md:mb-0">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center">
                <FiClock className="mr-2 text-primary-600" /> Active Timer
              </h2>
              <div className="mt-2">
                <p className="text-2xl font-bold text-primary-600">{formatElapsedTime(elapsedTime)}</p>
                <p className="mt-1 text-gray-600 dark:text-gray-400">
                  {activeTimer.customer?.name || 'No Customer'} / {activeTimer.project?.name || 'No Project'} / {activeTimer.task?.name || 'Unknown Task'}
                </p>
                {activeTimer.description && (
                  <p className="mt-2 text-sm text-gray-500 dark:text-gray-500">{activeTimer.description}</p>
                )}
              </div>
            </div>
            
            <div>
              <button 
                onClick={stopTimer}
                className="btn btn-primary flex items-center"
              >
                <FiPause className="mr-2" /> Stop Timer
              </button>
            </div>
          </div>
        </div>
      )}

      {(tasks.length === 0 || projects.length === 0 || customers.length === 0) && !loading && (
        <div className="bg-yellow-50 dark:bg-yellow-900/20 text-yellow-800 dark:text-yellow-400 p-4 rounded-md mb-6">
          <p>
            {tasks.length === 0 && 'You need to create a task before you can track time. '}
            {projects.length === 0 && 'You need to create a project before you can track time. '}
            {customers.length === 0 && 'You need to create a customer before you can track time. '}
            Each time entry must be associated with a task, project, and customer.
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {tasks.length === 0 && (
              <button
                onClick={() => window.location.href = '/tasks'}
                className="btn btn-primary btn-sm flex items-center justify-center"
              >
                <FiPlus className="mr-2" /> Create a Task
              </button>
            )}
            {projects.length === 0 && (
              <button
                onClick={() => window.location.href = '/projects'}
                className="btn btn-primary btn-sm flex items-center justify-center"
              >
                <FiPlus className="mr-2" /> Create a Project
              </button>
            )}
            {customers.length === 0 && (
              <button
                onClick={() => window.location.href = '/customers'}
                className="btn btn-primary btn-sm flex items-center justify-center"
              >
                <FiPlus className="mr-2" /> Create a Customer
              </button>
            )}
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-8">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-600"></div>
        </div>
      ) : filteredTimeEntries.length > 0 ? (
        <>
          {/* Desktop view - Table */}
          <div className="hidden sm:block bg-white dark:bg-gray-800 shadow-md rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-700">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Customer / Project / Task
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Date
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Duration
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Rate
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Description
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                  {filteredTimeEntries.map((entry) => (
                    <tr key={entry.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                      <td className="px-6 py-4 text-sm font-medium text-gray-900 dark:text-white">
                        <div>
                          <span className="font-medium">{entry.customer?.name || 'Unknown Customer'}</span>
                        </div>
                        <div className="text-sm text-gray-500 dark:text-gray-400">
                          {entry.project?.name || 'Unknown Project'} / {entry.task?.name || 'Unknown Task'}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                        {entry.date 
                          ? formatDate(new Date(entry.date))
                          : entry.start_time 
                            ? formatDate(new Date(entry.start_time))
                            : '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                        {formatDuration(entry.duration_minutes, entry.start_time, entry.end_time)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                        {entry.rate ? formatCurrency(entry.rate) + '/hr' : '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <div className="flex flex-col space-y-1">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            entry.billable 
                              ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' 
                              : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                          }`}>
                            <FiDollarSign className={`mr-1 ${entry.billable ? 'opacity-100' : 'opacity-50'}`} />
                            {entry.billable ? 'Billable' : 'Non-billable'}
                          </span>
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            entry.active 
                              ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400' 
                              : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                          }`}>
                            <FiToggleRight className={`mr-1 ${entry.active ? 'opacity-100' : 'opacity-50'}`} />
                            {entry.active ? 'Active' : 'Inactive'}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-300 max-w-xs truncate">
                        {entry.description || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        {!entry.end_time && entry.start_time ? (
                          <button
                            onClick={stopTimer}
                            className="text-primary-600 hover:text-primary-900 dark:hover:text-primary-400 mr-3"
                          >
                            <FiPause className="inline" />
                          </button>
                        ) : (
                          <></>
                        )}
                        <button
                          onClick={() => openModal(entry)}
                          className="text-primary-600 hover:text-primary-900 dark:hover:text-primary-400 mr-3"
                        >
                          <FiEdit2 className="inline" />
                        </button>
                        <button
                          onClick={() => openDeleteModal(entry)}
                          className="text-red-600 hover:text-red-900 dark:hover:text-red-400"
                        >
                          <FiTrash2 className="inline" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile view - Card list */}
          <div className="sm:hidden space-y-4">
            {filteredTimeEntries.map((entry) => (
              <div 
                key={entry.id} 
                className="bg-white dark:bg-gray-800 shadow-md rounded-lg overflow-hidden"
              >
                <div 
                  className="p-4 cursor-pointer"
                  onClick={() => toggleExpandEntry(entry.id)}
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="font-medium text-gray-900 dark:text-white">
                        {entry.task?.name || 'Unknown Task'}
                      </h3>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        {entry.customer?.name || 'Unknown Customer'} / {entry.project?.name || 'Unknown Project'}
                      </p>
                    </div>
                    <div className="flex items-center">
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300 mr-2">
                        {formatDuration(entry.duration_minutes, entry.start_time, entry.end_time)}
                      </span>
                      <FiChevronRight 
                        className={`transition-transform ${expandedEntryId === entry.id ? 'transform rotate-90' : ''}`} 
                      />
                    </div>
                  </div>
                  
                  <div className="mt-2 flex items-center text-xs text-gray-500 dark:text-gray-400">
                    <FiCalendar className="mr-1" />
                    <span>
                      {entry.date 
                        ? formatDate(new Date(entry.date))
                        : entry.start_time 
                          ? formatDate(new Date(entry.start_time))
                          : '-'}
                    </span>
                  </div>
                </div>
                
                {expandedEntryId === entry.id && (
                  <div className="px-4 pb-4 pt-2 border-t border-gray-100 dark:border-gray-700">
                    <div className="flex flex-wrap gap-2 mb-3">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        entry.billable 
                          ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' 
                          : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                      }`}>
                        <FiDollarSign className={`mr-1 ${entry.billable ? 'opacity-100' : 'opacity-50'}`} />
                        {entry.billable ? 'Billable' : 'Non-billable'}
                      </span>
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        entry.active 
                          ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400' 
                          : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                      }`}>
                        <FiToggleRight className={`mr-1 ${entry.active ? 'opacity-100' : 'opacity-50'}`} />
                        {entry.active ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                    
                    {entry.rate && (
                      <div className="mb-3">
                        <h4 className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Rate:</h4>
                        <p className="text-sm text-gray-700 dark:text-gray-300">{formatCurrency(entry.rate)}/hr</p>
                      </div>
                    )}
                    
                    {entry.description && (
                      <div className="mb-3">
                        <h4 className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Description:</h4>
                        <p className="text-sm text-gray-700 dark:text-gray-300">{entry.description}</p>
                      </div>
                    )}
                    
                    <div className="flex justify-between mt-3 pt-3 border-t border-gray-100 dark:border-gray-700">
                      <div className="flex space-x-2">
                        {!entry.end_time && entry.start_time ? (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              stopTimer();
                            }}
                            className="btn btn-sm btn-primary flex items-center"
                            aria-label="Stop timer"
                          >
                            <FiPause className="mr-1" /> Stop
                          </button>
                        ) : (
                          <></>
                        )}
                      </div>
                      <div className="flex space-x-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            openModal(entry);
                          }}
                          className="btn btn-sm btn-secondary flex items-center"
                          aria-label="Edit time entry"
                        >
                          <FiEdit2 className="mr-1" /> Edit
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            openDeleteModal(entry);
                          }}
                          className="btn btn-sm btn-danger flex items-center"
                          aria-label="Delete time entry"
                        >
                          <FiTrash2 className="mr-1" /> Delete
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      ) : (
        <div className="bg-white dark:bg-gray-800 shadow-md rounded-lg p-6 text-center">
          <p className="text-gray-500 dark:text-gray-400 mb-4">
            {searchQuery || Object.values(filters).some(v => v) 
              ? 'No time entries match your search or filters.' 
              : 'No time entries found. Add your first time entry to get started.'}
          </p>
          {searchQuery || Object.values(filters).some(v => v) ? (
            <div className="flex justify-center space-x-2">
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="btn btn-secondary"
                >
                  Clear Search
                </button>
              )}
              {Object.values(filters).some(v => v) && (
                <button
                  onClick={resetFilters}
                  className="btn btn-secondary"
                >
                  Clear Filters
                </button>
              )}
            </div>
          ) : tasks.length > 0 && projects.length > 0 && customers.length > 0 ? (
            <button
              onClick={() => openModal()}
              className="btn btn-primary flex items-center justify-center mx-auto"
            >
              <FiPlus className="mr-2" /> Add Time Entry
            </button>
          ) : (
            <div className="flex flex-wrap justify-center gap-2">
              {tasks.length === 0 && (
                <button
                  onClick={() => window.location.href = '/tasks'}
                  className="btn btn-primary flex items-center justify-center"
                >
                  <FiPlus className="mr-2" /> Add Task First
                </button>
              )}
              {projects.length === 0 && (
                <button
                  onClick={() => window.location.href = '/projects'}
                  className="btn btn-primary flex items-center justify-center"
                >
                  <FiPlus className="mr-2" /> Add Project First
                </button>
              )}
              {customers.length === 0 && (
                <button
                  onClick={() => window.location.href = '/customers'}
                  className="btn btn-primary flex items-center justify-center"
                >
                  <FiPlus className="mr-2" /> Add Customer First
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Add/Edit Time Entry Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 transition-opacity" onClick={closeModal}>
              <div className="absolute inset-0 bg-gray-500 dark:bg-gray-900 opacity-75"></div>
            </div>
            <span className="hidden sm:inline-block sm:align-middle sm:h-screen">&#8203;</span>
            <div className="inline-block align-bottom bg-white dark:bg-gray-800 rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
              <div className="bg-white dark:bg-gray-800 px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
                  {currentTimeEntry ? 'Edit Time Entry' : 'Add Time Entry'}
                </h3>
                
                {error && (
                  <div className="mb-4 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 p-3 rounded-md text-sm">
                    {error}
                  </div>
                )}
                
                <form onSubmit={handleSubmit}>
                  <div className="mb-4">
                    <label htmlFor="customer_id" className="label">
                      Customer <span className="text-red-600">*</span>
                    </label>
                    <select
                      id="customer_id"
                      name="customer_id"
                      value={formData.customer_id}
                      onChange={handleCustomerChange}
                      className="input"
                      required
                    >
                      <option value="">Select a customer</option>
                      {customers.map(customer => (
                        <option key={customer.id} value={customer.id}>
                          {customer.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  
                  <div className="mb-4">
                    <label htmlFor="project_id" className="label">
                      Project <span className="text-red-600">*</span>
                    </label>
                    <select
                      id="project_id"
                      name="project_id"
                      value={formData.project_id}
                      onChange={handleProjectChange}
                      className="input"
                      required
                      disabled={!formData.customer_id}
                    >
                      <option value="">Select a project</option>
                      {filteredProjects.map(project => (
                        <option key={project.id} value={project.id}>
                          {project.name}
                        </option>
                      ))}
                    </select>
                    {!formData.customer_id && (
                      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                        Select a customer first
                      </p>
                    )}
                  </div>
                  
                  <div className="mb-4">
                    <label htmlFor="task_id" className="label">
                      Task <span className="text-red-600">*</span>
                    </label>
                    <select
                      id="task_id"
                      name="task_id"
                      value={formData.task_id}
                      onChange={handleInputChange}
                      className="input"
                      required
                    >
                      <option value="">Select a task</option>
                      {tasks.map(task => (
                        <option key={task.id} value={task.id}>
                          {task.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  
                  <div className="mb-4">
                    <label htmlFor="date" className="label">
                      Date <span className="text-red-600">*</span>
                    </label>
                    <div className="relative">
                      <input
                        type="date"
                        id="date"
                        name="date"
                        value={formData.date}
                        onChange={handleInputChange}
                        className="input pl-10"
                        required
                      />
                      <FiCalendar className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                    </div>
                  </div>
                  
                  <div className="mb-4">
                    <label className="label">
                      Duration <span className="text-red-600">*</span>
                    </label>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="relative">
                        <input
                          type="number"
                          id="duration_hours"
                          name="duration_hours"
                          value={formData.duration_hours}
                          onChange={handleInputChange}
                          className="input pl-10"
                          min="0"
                          placeholder="Hours"
                        />
                        <FiClock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                      </div>
                      <div>
                        <input
                          type="number"
                          id="duration_minutes"
                          name="duration_minutes"
                          value={formData.duration_minutes}
                          onChange={handleInputChange}
                          className="input"
                          min="0"
                          max="59"
                          placeholder="Minutes"
                        />
                      </div>
                    </div>
                  </div>
                  
                  <div className="mb-4">
                    <label htmlFor="rate" className="label">
                      Rate (per hour)
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        id="rate"
                        name="rate"
                        value={formData.rate}
                        onChange={handleInputChange}
                        className="input pl-10"
                        min="0"
                        step="0.01"
                        placeholder="0.00"
                      />
                      <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400">kr</span>
                    </div>
                  </div>
                  
                  <div className="mb-4">
                    <label htmlFor="description" className="label">
                      Description
                    </label>
                    <textarea
                      id="description"
                      name="description"
                      value={formData.description}
                      onChange={handleInputChange}
                      className="input"
                      rows={3}
                      placeholder="What did you work on?"
                    />
                  </div>
                  
                  <div className="mb-4 flex space-x-6">
                    <div className="flex items-center">
                      <input
                        type="checkbox"
                        id="billable"
                        name="billable"
                        checked={formData.billable}
                        onChange={handleCheckboxChange}
                        className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                      />
                      <label htmlFor="billable" className="ml-2 block text-sm text-gray-700 dark:text-gray-300">
                        Billable
                      </label>
                    </div>
                    
                    <div className="flex items-center">
                      <input
                        type="checkbox"
                        id="active"
                        name="active"
                        checked={formData.active}
                        onChange={handleCheckboxChange}
                        className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                      />
                      <label htmlFor="active" className="ml-2 block text-sm text-gray-700 dark:text-gray-300">
                        Active
                      </label>
                    </div>
                  </div>
                  
                  <div className="flex justify-end space-x-2 mt-6">
                    <button
                      type="button"
                      onClick={closeModal}
                      className="btn btn-secondary"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="btn btn-primary"
                    >
                      {currentTimeEntry ? 'Update' : 'Create'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {isDeleteModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 transition-opacity" onClick={closeDeleteModal}>
              <div className="absolute inset-0 bg-gray-500 dark:bg-gray-900 opacity-75"></div>
            </div>
            <span className="hidden sm:inline-block sm:align-middle sm:h-screen">&#8203;</span>
            <div className="inline-block align-bottom bg-white dark:bg-gray-800 rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
              <div className="bg-white dark:bg-gray-800 px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
                  Delete Time Entry
                </h3>
                
                {error && (
                  <div className="mb-4 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 p-3 rounded-md text-sm">
                    {error}
                  </div>
                )}
                
                <p className="text-gray-600 dark:text-gray-400">
                  Are you sure you want to delete this time entry? This action cannot be undone.
                </p>
                
                <div className="flex justify-end space-x-2 mt-6">
                  <button
                    type="button"
                    onClick={closeDeleteModal}
                    className="btn btn-secondary"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleDelete}
                    className="btn btn-danger"
                  >
                    Delete
                  </button>
                  </div>
              </div>
            </div>
          </div>
        </div>
      )}

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
                  Filter Time Entries
                </h3>
                
                <div className="space-y-4">
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
                    >
                      <option value="">All Projects</option>
                      {projects.map(project => (
                        <option key={project.id} value={project.id}>
                          {project.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  
                  <div>
                    <label htmlFor="task" className="label">
                      Task
                    </label>
                    <select
                      id="task"
                      name="task"
                      value={filters.task}
                      onChange={handleFilterChange}
                      className="input"
                    >
                      <option value="">All Tasks</option>
                      {tasks.map(task => (
                        <option key={task.id} value={task.id}>
                          {task.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  
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
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="billable" className="label">
                        Billable
                      </label>
                      <select
                        id="billable"
                        name="billable"
                        value={filters.billable}
                        onChange={handleFilterChange}
                        className="input"
                      >
                        <option value="">All</option>
                        <option value="yes">Yes</option>
                        <option value="no">No</option>
                      </select>
                    </div>
                    
                    <div>
                      <label htmlFor="active" className="label">
                        Active
                      </label>
                      <select
                        id="active"
                        name="active"
                        value={filters.active}
                        onChange={handleFilterChange}
                        className="input"
                      >
                        <option value="">All</option>
                        <option value="yes">Yes</option>
                        <option value="no">No</option>
                      </select>
                    </div>
                  </div>
                </div>
                
                <div className="flex justify-end space-x-2 mt-6">
                  <button
                    type="button"
                    onClick={resetFilters}
                    className="btn btn-secondary"
                  >
                    Reset
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
