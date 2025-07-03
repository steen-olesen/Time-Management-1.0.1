import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { FiPlus, FiEdit2, FiTrash2, FiSearch, FiX, FiCalendar, FiDollarSign, FiFileText, FiChevronRight } from 'react-icons/fi'
import { format } from 'date-fns'

interface Customer {
  id: string
  name: string
}

interface Project {
  id: string
  name: string
  description: string
  status: string
  customer_id: string
  created_at: string
  start_date: string | null
  end_date: string | null
  budget: number | null
  customer: Customer
}

export default function Projects() {
  const { user } = useAuth()
  const [projects, setProjects] = useState<Project[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(true)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
  const [currentProject, setCurrentProject] = useState<Project | null>(null)
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    status: 'active',
    customer_id: '',
    start_date: '',
    end_date: '',
    budget: ''
  })
  const [searchQuery, setSearchQuery] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [expandedProjectId, setExpandedProjectId] = useState<string | null>(null)

  useEffect(() => {
    if (!user) return
    fetchProjects()
    fetchCustomers()
  }, [user])

  const fetchProjects = async () => {
    try {
      setLoading(true)
      
      const { data, error } = await supabase
        .from('projects')
        .select(`
          *,
          customer:customers(id, name)
        `)
        .eq('user_id', user?.id)
        .order('name')
      
      if (error) throw error
      
      setProjects(data || [])
    } catch (error: any) {
      console.error('Error fetching projects:', error.message)
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
    }
  }

  const openModal = (project: Project | null = null) => {
    setCurrentProject(project)
    if (project) {
      setFormData({
        name: project.name,
        description: project.description || '',
        status: project.status || 'active',
        customer_id: project.customer_id,
        start_date: project.start_date || '',
        end_date: project.end_date || '',
        budget: project.budget ? String(project.budget) : ''
      })
    } else {
      setFormData({
        name: '',
        description: '',
        status: 'active',
        customer_id: customers.length > 0 ? customers[0].id : '',
        start_date: '',
        end_date: '',
        budget: ''
      })
    }
    setIsModalOpen(true)
  }

  const closeModal = () => {
    setIsModalOpen(false)
    setError(null)
  }

  const openDeleteModal = (project: Project) => {
    setCurrentProject(project)
    setIsDeleteModalOpen(true)
  }

  const closeDeleteModal = () => {
    setIsDeleteModalOpen(false)
    setError(null)
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!formData.name.trim()) {
      setError('Project name is required')
      return
    }
    
    if (!formData.customer_id) {
      setError('Please select a customer')
      return
    }
    
    try {
      setError(null)
      
      if (currentProject) {
        // Update existing project
        const { error } = await supabase
          .from('projects')
          .update({
            name: formData.name,
            description: formData.description,
            status: formData.status,
            customer_id: formData.customer_id,
            start_date: formData.start_date || null,
            end_date: formData.end_date || null,
            budget: formData.budget ? parseFloat(formData.budget) : null
          })
          .eq('id', currentProject.id)
        
        if (error) throw error
      } else {
        // Create new project
        const { error } = await supabase
          .from('projects')
          .insert([
            {
              user_id: user?.id,
              name: formData.name,
              description: formData.description,
              status: formData.status,
              customer_id: formData.customer_id,
              start_date: formData.start_date || null,
              end_date: formData.end_date || null,
              budget: formData.budget ? parseFloat(formData.budget) : null
            }
          ])
        
        if (error) throw error
      }
      
      closeModal()
      fetchProjects()
    } catch (error: any) {
      setError(error.message)
    }
  }

  const handleDelete = async () => {
    if (!currentProject) return
    
    try {
      // Check if project has any tasks
      const { count, error: countError } = await supabase
        .from('tasks')
        .select('id', { count: 'exact', head: true })
        .eq('project_id', currentProject.id)
      
      if (countError) throw countError
      
      if (count && count > 0) {
        setError(`Cannot delete project. There are ${count} tasks associated with this project.`)
        return
      }
      
      const { error } = await supabase
        .from('projects')
        .delete()
        .eq('id', currentProject.id)
      
      if (error) throw error
      
      closeDeleteModal()
      fetchProjects()
    } catch (error: any) {
      setError(error.message)
    }
  }

  const filteredProjects = projects.filter(project => 
    project.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    project.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    project.customer?.name.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
      case 'completed':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400'
      case 'on-hold':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400'
      case 'cancelled':
        return 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400'
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
    }
  }

  const formatStatus = (status: string) => {
    return status.charAt(0).toUpperCase() + status.slice(1).replace('-', ' ')
  }

  const toggleExpandProject = (projectId: string) => {
    if (expandedProjectId === projectId) {
      setExpandedProjectId(null)
    } else {
      setExpandedProjectId(projectId)
    }
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-4 sm:mb-0">Projects</h1>
        <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-2">
          <div className="relative">
            <input
              type="text"
              placeholder="Search projects..."
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
          <button
            onClick={() => openModal()}
            className="btn btn-primary flex items-center justify-center"
            disabled={customers.length === 0}
          >
            <FiPlus className="mr-2" /> Add Project
          </button>
        </div>
      </div>

      {customers.length === 0 && !loading && (
        <div className="bg-yellow-50 dark:bg-yellow-900/20 text-yellow-800 dark:text-yellow-400 p-4 rounded-md mb-6">
          <p>You need to create a customer before you can add projects.</p>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-8">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-600"></div>
        </div>
      ) : filteredProjects.length > 0 ? (
        <>
          {/* Desktop view - Table */}
          <div className="hidden sm:block bg-white dark:bg-gray-800 shadow-md rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-700">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Name
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Customer
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
                  {filteredProjects.map((project) => (
                    <tr key={project.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                        {project.name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                        {project.customer?.name || 'Unknown Customer'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusBadgeClass(project.status)}`}>
                          {formatStatus(project.status)}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-300 max-w-xs truncate">
                        {project.description || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <button
                          onClick={() => openModal(project)}
                          className="text-primary-600 hover:text-primary-900 dark:hover:text-primary-400 mr-3"
                        >
                          <FiEdit2 className="inline" />
                        </button>
                        <button
                          onClick={() => openDeleteModal(project)}
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
            {filteredProjects.map((project) => (
              <div 
                key={project.id} 
                className="bg-white dark:bg-gray-800 shadow-md rounded-lg overflow-hidden"
              >
                <div 
                  className="p-4 cursor-pointer"
                  onClick={() => toggleExpandProject(project.id)}
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="font-medium text-gray-900 dark:text-white">
                        {project.name}
                      </h3>
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                        {project.customer?.name || 'Unknown Customer'}
                      </p>
                    </div>
                    <div className="flex items-center">
                      <span className={`mr-2 px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusBadgeClass(project.status)}`}>
                        {formatStatus(project.status)}
                      </span>
                      <FiChevronRight 
                        className={`transition-transform ${expandedProjectId === project.id ? 'transform rotate-90' : ''}`} 
                      />
                    </div>
                  </div>
                </div>
                
                {expandedProjectId === project.id && (
                  <div className="px-4 pb-4 pt-2 border-t border-gray-100 dark:border-gray-700">
                    <div className="space-y-3">
                      {project.description && (
                        <div className="flex items-start text-sm text-gray-500 dark:text-gray-400">
                          <FiFileText className="mr-2 mt-0.5 flex-shrink-0" />
                          <span>{project.description}</span>
                        </div>
                      )}
                      
                      {project.budget && (
                        <div className="flex items-center text-sm text-gray-500 dark:text-gray-400">
                          <FiDollarSign className="mr-2 flex-shrink-0" />
                          <span>Budget: {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(project.budget)}</span>
                        </div>
                      )}
                      
                      <div className="flex flex-wrap gap-3 text-sm text-gray-500 dark:text-gray-400">
                        {project.start_date && (
                          <div className="flex items-center">
                            <FiCalendar className="mr-1 flex-shrink-0" />
                            <span>Start: {format(new Date(project.start_date), 'MMM d, yyyy')}</span>
                          </div>
                        )}
                        
                        {project.end_date && (
                          <div className="flex items-center">
                            <FiCalendar className="mr-1 flex-shrink-0" />
                            <span>End: {format(new Date(project.end_date), 'MMM d, yyyy')}</span>
                          </div>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex justify-end space-x-2 mt-4 pt-3 border-t border-gray-100 dark:border-gray-700">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          openModal(project);
                        }}
                        className="btn btn-sm btn-secondary flex items-center"
                        aria-label="Edit project"
                      >
                        <FiEdit2 className="mr-1" /> Edit
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          openDeleteModal(project);
                        }}
                        className="btn btn-sm btn-danger flex items-center"
                        aria-label="Delete project"
                      >
                        <FiTrash2 className="mr-1" /> Delete
                      </button>
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
            {searchQuery ? 'No projects match your search.' : 'No projects found. Add your first project to get started.'}
          </p>
          {searchQuery ? (
            <button
              onClick={() => setSearchQuery('')}
              className="btn btn-secondary"
            >
              Clear Search
            </button>
          ) : customers.length > 0 ? (
            <button
              onClick={() => openModal()}
              className="btn btn-primary flex items-center justify-center mx-auto"
            >
              <FiPlus className="mr-2" /> Add Project
            </button>
          ) : (
            <button
              onClick={() => window.location.href = '/customers'}
              className="btn btn-primary flex items-center justify-center mx-auto"
            >
              <FiPlus className="mr-2" /> Add Customer First
            </button>
          )}
        </div>
      )}

      {/* Add/Edit Project Modal */}
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
                  {currentProject ? 'Edit Project' : 'Add Project'}
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
                      onChange={handleInputChange}
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
                    <label htmlFor="name" className="label">
                      Project Name <span className="text-red-600">*</span>
                    </label>
                    <input
                      type="text"
                      id="name"
                      name="name"
                      value={formData.name}
                      onChange={handleInputChange}
                      className="input"
                      required
                    />
                  </div>
                  
                  <div className="mb-4">
                    <label htmlFor="status" className="label">
                      Status
                    </label>
                    <select
                      id="status"
                      name="status"
                      value={formData.status}
                      onChange={handleInputChange}
                      className="input"
                    >
                      <option value="active">Active</option>
                      <option value="completed">Completed</option>
                      <option value="on-hold">On Hold</option>
                      <option value="cancelled">Cancelled</option>
                    </select>
                  </div>
                  
                  <div className="mb-4">
                    <label htmlFor="start_date" className="label">
                      Start Date
                    </label>
                    <input
                      type="date"
                      id="start_date"
                      name="start_date"
                      value={formData.start_date}
                      onChange={handleInputChange}
                      className="input"
                    />
                  </div>
                  
                  <div className="mb-4">
                    <label htmlFor="end_date" className="label">
                      End Date
                    </label>
                    <input
                      type="date"
                      id="end_date"
                      name="end_date"
                      value={formData.end_date}
                      onChange={handleInputChange}
                      className="input"
                    />
                  </div>
                  
                  <div className="mb-4">
                    <label htmlFor="budget" className="label">
                      Budget
                    </label>
                    <input
                      type="number"
                      id="budget"
                      name="budget"
                      value={formData.budget}
                      onChange={handleInputChange}
                      className="input"
                      step="0.01"
                      min="0"
                    />
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
                    />
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
                      {currentProject ? 'Update' : 'Create'}
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
                  Delete Project
                </h3>
                
                {error && (
                  <div className="mb-4 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 p-3 rounded-md text-sm">
                    {error}
                  </div>
                )}
                
                <p className="text-gray-600 dark:text-gray-400">
                  Are you sure you want to delete <span className="font-semibold">{currentProject?.name}</span>? This action cannot be undone.
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
    </div>
  )
}
