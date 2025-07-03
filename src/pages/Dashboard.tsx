import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { FiUsers, FiFolder, FiCheckSquare, FiClock, FiPieChart, FiCalendar } from 'react-icons/fi'
import { startOfDay, startOfMonth, endOfMonth, subMonths, format, isAfter, isBefore, isEqual, parseISO } from 'date-fns'
import { startOfWeek, endOfWeek } from '../utils/localization'

interface Stats {
  customers: number;
  projects: number;
  tasks: number;
  timeEntries: number;
}

interface TimeHighlight {
  period: string;
  hours: number;
  icon: JSX.Element;
  color: string;
  dateRange: string;
}

// Define a more specific type for time entries
interface TimeEntry {
  id: string;
  user_id: string;
  task_id?: string;
  description?: string;
  start_time?: string;
  end_time?: string;
  duration?: number;
  duration_minutes?: number;
  date?: string;
  created_at: string;
}

export default function Dashboard() {
  const { user } = useAuth()
  const [stats, setStats] = useState<Stats>({
    customers: 0,
    projects: 0,
    tasks: 0,
    timeEntries: 0
  })
  const [timeHighlights, setTimeHighlights] = useState<TimeHighlight[]>([])
  const [loading, setLoading] = useState(true)
  const [debugInfo, setDebugInfo] = useState<any>(null)

  useEffect(() => {
    if (!user) return

    const fetchDashboardData = async () => {
      try {
        setLoading(true)
        
        // Fetch stats
        const [
          { count: customersCount },
          { count: projectsCount },
          { count: tasksCount },
          { count: timeEntriesCount }
        ] = await Promise.all([
          supabase.from('customers').select('id', { count: 'exact', head: true }).eq('user_id', user.id),
          supabase.from('projects').select('id', { count: 'exact', head: true }).eq('user_id', user.id),
          supabase.from('tasks').select('id', { count: 'exact', head: true }).eq('user_id', user.id),
          supabase.from('time_entries').select('id', { count: 'exact', head: true }).eq('user_id', user.id)
        ])
        
        setStats({
          customers: customersCount || 0,
          projects: projectsCount || 0,
          tasks: tasksCount || 0,
          timeEntries: timeEntriesCount || 0
        })

        // Get all time entries for the user without any date filtering
        const { data: allTimeEntries, error } = await supabase
          .from('time_entries')
          .select('*')
          .eq('user_id', user.id)
        
        if (error) {
          console.error('Error fetching time entries:', error)
          return
        }

        // Define time periods using Monday as first day of week
        const now = new Date()
        const today = startOfDay(now)
        const thisWeekStart = startOfWeek(now)
        const thisWeekEnd = endOfWeek(now)
        const thisMonthStart = startOfMonth(now)
        const thisMonthEnd = endOfMonth(now)
        const lastMonthStart = startOfMonth(subMonths(now, 1))
        const lastMonthEnd = endOfMonth(subMonths(now, 1))

        // Store debug info including week boundaries
        setDebugInfo({
          entriesCount: allTimeEntries?.length || 0,
          sampleEntries: allTimeEntries?.slice(0, 3) || [],
          weekBoundaries: {
            thisWeekStart: thisWeekStart.toISOString(),
            thisWeekEnd: thisWeekEnd.toISOString(),
            today: today.toISOString()
          }
        })

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
        const todayEntries = allTimeEntries?.filter(entry => {
          const entryDate = getEntryDate(entry)
          return isDateInRange(entryDate, today)
        }) || []

        const thisWeekEntries = allTimeEntries?.filter(entry => {
          const entryDate = getEntryDate(entry)
          return isDateInRange(entryDate, thisWeekStart, thisWeekEnd)
        }) || []

        const thisMonthEntries = allTimeEntries?.filter(entry => {
          const entryDate = getEntryDate(entry)
          return isDateInRange(entryDate, thisMonthStart, thisMonthEnd)
        }) || []

        const lastMonthEntries = allTimeEntries?.filter(entry => {
          const entryDate = getEntryDate(entry)
          return isDateInRange(entryDate, lastMonthStart, lastMonthEnd)
        }) || []

        // Calculate total hours for each period
        const calculateTotalHours = (entries: TimeEntry[] | null): number => {
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
            
            // Try duration next
            if (entry.duration !== null && entry.duration !== undefined) {
              const minutes = parseFloat(String(entry.duration))
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

        // Update time highlights with calculated hours using Monday-based weeks
        setTimeHighlights([
          { 
            period: 'Today', 
            hours: calculateTotalHours(todayEntries), 
            icon: <FiClock />, 
            color: 'bg-blue-500',
            dateRange: format(now, 'MMM d')
          },
          { 
            period: 'This Week', 
            hours: calculateTotalHours(thisWeekEntries), 
            icon: <FiClock />, 
            color: 'bg-green-500',
            dateRange: `${format(thisWeekStart, 'MMM d')} - ${format(thisWeekEnd, 'MMM d')}`
          },
          { 
            period: 'This Month', 
            hours: calculateTotalHours(thisMonthEntries), 
            icon: <FiCalendar />, 
            color: 'bg-purple-500',
            dateRange: format(now, 'MMMM yyyy')
          },
          { 
            period: 'Last Month', 
            hours: calculateTotalHours(lastMonthEntries), 
            icon: <FiCalendar />, 
            color: 'bg-orange-500',
            dateRange: format(subMonths(now, 1), 'MMMM yyyy')
          }
        ])
      } catch (error) {
        console.error('Error fetching dashboard data:', error)
      } finally {
        setLoading(false)
      }
    }
    
    fetchDashboardData()
  }, [user])

  const statCards = [
    { title: 'Customers', count: stats.customers, icon: <FiUsers />, color: 'bg-blue-500', link: '/customers' },
    { title: 'Projects', count: stats.projects, icon: <FiFolder />, color: 'bg-green-500', link: '/projects' },
    { title: 'Tasks', count: stats.tasks, icon: <FiCheckSquare />, color: 'bg-purple-500', link: '/tasks' },
    { title: 'Time Entries', count: stats.timeEntries, icon: <FiClock />, color: 'bg-orange-500', link: '/time-entries' }
  ]

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Dashboard</h1>
        <Link to="/time-entries" className="btn btn-primary w-full sm:w-auto text-center">
          View All Time Entries
        </Link>
      </div>
      
      {/* Stats - Always 2 columns on mobile, 4 on larger screens */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        {statCards.map((stat) => (
          <Link 
            key={stat.title} 
            to={stat.link}
            className="card hover:shadow-lg transition-shadow p-3 md:p-4"
          >
            <div className="flex items-center">
              <div className={`p-2 md:p-3 rounded-full ${stat.color} text-white mr-2 md:mr-4 flex-shrink-0`}>
                {stat.icon}
              </div>
              <div className="min-w-0">
                <p className="text-xs md:text-sm text-gray-500 dark:text-gray-400 truncate">{stat.title}</p>
                <p className="text-lg md:text-2xl font-semibold text-gray-900 dark:text-white">{stat.count}</p>
              </div>
            </div>
          </Link>
        ))}
      </div>
      
      {/* Time Highlights - Always 2 columns on mobile, 4 on larger screens */}
      <div className="card p-4">
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
      
      {/* Debug Info - Only visible in development */}
      {process.env.NODE_ENV !== 'production' && debugInfo && (
        <div className="card bg-gray-100 dark:bg-gray-900 p-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Debug Info</h2>
          <p>Total Time Entries: {debugInfo.entriesCount}</p>
          <div className="mt-2">
            <h3 className="font-medium">Week Boundaries:</h3>
            <pre className="text-xs mt-2 bg-gray-200 dark:bg-gray-800 p-2 rounded overflow-auto">
              {JSON.stringify(debugInfo.weekBoundaries, null, 2)}
            </pre>
          </div>
          <div className="mt-2">
            <h3 className="font-medium">Sample Entries:</h3>
            <pre className="text-xs mt-2 bg-gray-200 dark:bg-gray-800 p-2 rounded overflow-auto">
              {JSON.stringify(debugInfo.sampleEntries, null, 2)}
            </pre>
          </div>
        </div>
      )}
      
      {/* Quick Links - Always 2 columns on mobile, 4 on larger screens */}
      <div className="card p-4">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Quick Actions</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
          <Link to="/customers" className="btn btn-secondary w-full flex items-center justify-center py-3">
            <FiUsers className="mr-2" /> <span className="truncate">Add Customer</span>
          </Link>
          <Link to="/projects" className="btn btn-secondary w-full flex items-center justify-center py-3">
            <FiFolder className="mr-2" /> <span className="truncate">Add Project</span>
          </Link>
          <Link to="/tasks" className="btn btn-secondary w-full flex items-center justify-center py-3">
            <FiCheckSquare className="mr-2" /> <span className="truncate">Add Task</span>
          </Link>
          <Link to="/reports" className="btn btn-secondary w-full flex items-center justify-center py-3">
            <FiPieChart className="mr-2" /> <span className="truncate">View Reports</span>
          </Link>
        </div>
      </div>
    </div>
  )
}
