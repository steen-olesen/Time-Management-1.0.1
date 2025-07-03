import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { FiPlus, FiEdit2, FiTrash2, FiSearch, FiX, FiUser, FiMail, FiPhone, FiMapPin, FiChevronRight } from 'react-icons/fi'

interface Customer {
  id: string
  name: string
  email: string
  phone: string
  address: string
  contact_person: string
  is_active: boolean
  created_at: string
}

export default function Customers() {
  const { user } = useAuth()
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(true)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
  const [currentCustomer, setCurrentCustomer] = useState<Customer | null>(null)
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    address: '',
    contact_person: '',
    is_active: true
  })
  const [searchQuery, setSearchQuery] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [expandedCustomerId, setExpandedCustomerId] = useState<string | null>(null)

  useEffect(() => {
    if (!user) return
    fetchCustomers()
  }, [user])

  const fetchCustomers = async () => {
    try {
      setLoading(true)
      
      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .eq('user_id', user?.id)
        .order('name')
      
      if (error) throw error
      
      setCustomers(data || [])
    } catch (error: any) {
      console.error('Error fetching customers:', error.message)
    } finally {
      setLoading(false)
    }
  }

  const openModal = (customer: Customer | null = null) => {
    setCurrentCustomer(customer)
    if (customer) {
      setFormData({
        name: customer.name,
        email: customer.email || '',
        phone: customer.phone || '',
        address: customer.address || '',
        contact_person: customer.contact_person || '',
        is_active: customer.is_active !== false
      })
    } else {
      setFormData({
        name: '',
        email: '',
        phone: '',
        address: '',
        contact_person: '',
        is_active: true
      })
    }
    setIsModalOpen(true)
  }

  const closeModal = () => {
    setIsModalOpen(false)
    setError(null)
  }

  const openDeleteModal = (customer: Customer) => {
    setCurrentCustomer(customer)
    setIsDeleteModalOpen(true)
  }

  const closeDeleteModal = () => {
    setIsDeleteModalOpen(false)
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  const handleCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, checked } = e.target
    setFormData(prev => ({ ...prev, [name]: checked }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!formData.name.trim()) {
      setError('Customer name is required')
      return
    }
    
    try {
      setError(null)
      
      if (currentCustomer) {
        // Update existing customer
        const { error } = await supabase
          .from('customers')
          .update({
            name: formData.name,
            email: formData.email,
            phone: formData.phone,
            address: formData.address,
            contact_person: formData.contact_person,
            is_active: formData.is_active
          })
          .eq('id', currentCustomer.id)
        
        if (error) throw error
      } else {
        // Create new customer
        const { error } = await supabase
          .from('customers')
          .insert([
            {
              user_id: user?.id,
              name: formData.name,
              email: formData.email,
              phone: formData.phone,
              address: formData.address,
              contact_person: formData.contact_person,
              is_active: formData.is_active
            }
          ])
        
        if (error) throw error
      }
      
      closeModal()
      fetchCustomers()
    } catch (error: any) {
      setError(error.message)
    }
  }

  const handleDelete = async () => {
    if (!currentCustomer) return
    
    try {
      // Check if customer has any projects
      const { count, error: countError } = await supabase
        .from('projects')
        .select('id', { count: 'exact', head: true })
        .eq('customer_id', currentCustomer.id)
      
      if (countError) throw countError
      
      if (count && count > 0) {
        setError(`Cannot delete customer. There are ${count} projects associated with this customer.`)
        return
      }
      
      const { error } = await supabase
        .from('customers')
        .delete()
        .eq('id', currentCustomer.id)
      
      if (error) throw error
      
      closeDeleteModal()
      fetchCustomers()
    } catch (error: any) {
      setError(error.message)
    }
  }

  const filteredCustomers = customers.filter(customer => 
    customer.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    customer.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    customer.phone?.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const toggleExpandCustomer = (customerId: string) => {
    if (expandedCustomerId === customerId) {
      setExpandedCustomerId(null)
    } else {
      setExpandedCustomerId(customerId)
    }
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-4 sm:mb-0">Customers</h1>
        <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-2">
          <div className="relative">
            <input
              type="text"
              placeholder="Search customers..."
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
          >
            <FiPlus className="mr-2" /> Add Customer
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-8">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-600"></div>
        </div>
      ) : filteredCustomers.length > 0 ? (
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
                      Contact Person
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Email
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Phone
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Address
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                  {filteredCustomers.map((customer) => (
                    <tr key={customer.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                        {customer.name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                        {customer.contact_person || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                        {customer.email || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                        {customer.phone || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                          customer.is_active !== false
                            ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
                            : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                        }`}>
                          {customer.is_active !== false ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-300 max-w-xs truncate">
                        {customer.address || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <button
                          onClick={() => openModal(customer)}
                          className="text-primary-600 hover:text-primary-900 dark:hover:text-primary-400 mr-3"
                        >
                          <FiEdit2 className="inline" />
                        </button>
                        <button
                          onClick={() => openDeleteModal(customer)}
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
            {filteredCustomers.map((customer) => (
              <div 
                key={customer.id} 
                className="bg-white dark:bg-gray-800 shadow-md rounded-lg overflow-hidden"
              >
                <div 
                  className="p-4 cursor-pointer"
                  onClick={() => toggleExpandCustomer(customer.id)}
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="font-medium text-gray-900 dark:text-white">
                        {customer.name}
                      </h3>
                      {customer.contact_person && (
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 flex items-center">
                          <FiUser className="mr-1" size={14} />
                          {customer.contact_person}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center">
                      <span className={`mr-2 px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        customer.is_active !== false
                          ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
                          : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                      }`}>
                        {customer.is_active !== false ? 'Active' : 'Inactive'}
                      </span>
                      <FiChevronRight 
                        className={`transition-transform ${expandedCustomerId === customer.id ? 'transform rotate-90' : ''}`} 
                      />
                    </div>
                  </div>
                </div>
                
                {expandedCustomerId === customer.id && (
                  <div className="px-4 pb-4 pt-2 border-t border-gray-100 dark:border-gray-700">
                    <div className="space-y-2">
                      {customer.email && (
                        <div className="flex items-center text-sm text-gray-500 dark:text-gray-400">
                          <FiMail className="mr-2 flex-shrink-0" />
                          <span className="truncate">{customer.email}</span>
                        </div>
                      )}
                      
                      {customer.phone && (
                        <div className="flex items-center text-sm text-gray-500 dark:text-gray-400">
                          <FiPhone className="mr-2 flex-shrink-0" />
                          <span>{customer.phone}</span>
                        </div>
                      )}
                      
                      {customer.address && (
                        <div className="flex items-start text-sm text-gray-500 dark:text-gray-400">
                          <FiMapPin className="mr-2 mt-0.5 flex-shrink-0" />
                          <span>{customer.address}</span>
                        </div>
                      )}
                    </div>
                    
                    <div className="flex justify-end space-x-2 mt-4 pt-3 border-t border-gray-100 dark:border-gray-700">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          openModal(customer);
                        }}
                        className="btn btn-sm btn-secondary flex items-center"
                        aria-label="Edit customer"
                      >
                        <FiEdit2 className="mr-1" /> Edit
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          openDeleteModal(customer);
                        }}
                        className="btn btn-sm btn-danger flex items-center"
                        aria-label="Delete customer"
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
            {searchQuery ? 'No customers match your search.' : 'No customers found. Add your first customer to get started.'}
          </p>
          {searchQuery ? (
            <button
              onClick={() => setSearchQuery('')}
              className="btn btn-secondary"
            >
              Clear Search
            </button>
          ) : (
            <button
              onClick={() => openModal()}
              className="btn btn-primary flex items-center justify-center mx-auto"
            >
              <FiPlus className="mr-2" /> Add Customer
            </button>
          )}
        </div>
      )}

      {/* Add/Edit Customer Modal */}
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
                  {currentCustomer ? 'Edit Customer' : 'Add Customer'}
                </h3>
                
                {error && (
                  <div className="mb-4 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 p-3 rounded-md text-sm">
                    {error}
                  </div>
                )}
                
                <form onSubmit={handleSubmit}>
                  <div className="mb-4">
                    <label htmlFor="name" className="label">
                      Name <span className="text-red-600">*</span>
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
                    <label htmlFor="contact_person" className="label">
                      Contact Person
                    </label>
                    <input
                      type="text"
                      id="contact_person"
                      name="contact_person"
                      value={formData.contact_person}
                      onChange={handleInputChange}
                      className="input"
                    />
                  </div>
                  
                  <div className="mb-4">
                    <label htmlFor="email" className="label">
                      Email
                    </label>
                    <input
                      type="email"
                      id="email"
                      name="email"
                      value={formData.email}
                      onChange={handleInputChange}
                      className="input"
                    />
                  </div>
                  
                  <div className="mb-4">
                    <label htmlFor="phone" className="label">
                      Phone
                    </label>
                    <input
                      type="text"
                      id="phone"
                      name="phone"
                      value={formData.phone}
                      onChange={handleInputChange}
                      className="input"
                    />
                  </div>
                  
                  <div className="mb-4">
                    <label htmlFor="address" className="label">
                      Address
                    </label>
                    <textarea
                      id="address"
                      name="address"
                      value={formData.address}
                      onChange={handleInputChange}
                      className="input"
                      rows={3}
                    />
                  </div>
                  
                  <div className="mb-4 flex items-center">
                    <input
                      type="checkbox"
                      id="is_active"
                      name="is_active"
                      checked={formData.is_active}
                      onChange={handleCheckboxChange}
                      className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                    />
                    <label htmlFor="is_active" className="ml-2 block text-sm text-gray-900 dark:text-gray-300">
                      Active
                    </label>
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
                      {currentCustomer ? 'Update' : 'Create'}
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
                  Delete Customer
                </h3>
                
                {error && (
                  <div className="mb-4 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 p-3 rounded-md text-sm">
                    {error}
                  </div>
                )}
                
                <p className="text-gray-600 dark:text-gray-400">
                  Are you sure you want to delete <span className="font-semibold">{currentCustomer?.name}</span>? This action cannot be undone.
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
