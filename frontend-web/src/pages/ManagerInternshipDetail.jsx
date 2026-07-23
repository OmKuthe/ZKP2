// frontend-web/src/pages/ManagerInternshipDetail.jsx
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import api from '../api/client';

const ManagerInternshipDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [internship, setInternship] = useState(null);
  const [students, setStudents] = useState([]);
  const [availableStudents, setAvailableStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [selectedStudents, setSelectedStudents] = useState([]);
  const [message, setMessage] = useState('');

  const fetchData = async () => {
    try {
      const [detailRes, availableRes] = await Promise.all([
        api.get(`/manager/internship/${id}`),
        api.get(`/manager/internship/${id}/available-students`)
      ]);
      
      setInternship(detailRes.data.internship);
      setStudents(detailRes.data.students || []);
      setAvailableStudents(availableRes.data.available_students || []);
    } catch (error) {
      console.error('Error fetching internship details:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [id]);

  const handleAssignStudents = async () => {
    if (selectedStudents.length === 0) {
      setMessage('Please select at least one student');
      return;
    }

    try {
      await api.post(`/admin/internships/${id}/assign`, {
        student_ids: selectedStudents
      });
      setMessage('✅ Students assigned successfully!');
      setSelectedStudents([]);
      setShowAssignModal(false);
      fetchData();
    } catch (error) {
      setMessage(`❌ ${error.response?.data?.detail || 'Failed to assign students'}`);
    }
  };

  const handleRemoveStudent = async (studentId) => {
    if (!confirm('Remove this student from the internship?')) return;
    
    try {
      await api.delete(`/admin/internships/${id}/students/${studentId}`);
      fetchData();
    } catch (error) {
      setMessage(`❌ ${error.response?.data?.detail || 'Failed to remove student'}`);
    }
  };

  const toggleStudentSelection = (studentId) => {
    setSelectedStudents(prev =>
      prev.includes(studentId) 
        ? prev.filter(id => id !== studentId)
        : [...prev, studentId]
    );
  };

const handleDeleteInternship = async () => {
  if (!confirm(`Are you sure you want to delete internship "${internship?.name}"? This will remove all student assignments.`)) {
    return;
  }

  try {
    await api.delete(`/admin/internships/${id}`);
    setMessage('✅ Internship deleted successfully!');
    setTimeout(() => {
      navigate('/manager');
    }, 1500);
  } catch (error) {
    setMessage(`❌ Error: ${error.response?.data?.detail || error.message}`);
  }
};

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500"></div>
      </div>
    );
  }

  if (!internship) {
    return (
      <div className="card text-center py-12">
        <p className="text-slate-400">Internship not found</p>
        <Link to="/manager" className="text-primary-600 hover:underline mt-2 inline-block">
          ← Back to Dashboard
        </Link>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center gap-4 mb-6">
        <Link to="/manager" className="btn-secondary">← Back</Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-800">{internship.name}</h1>
          <p className="text-sm text-slate-500">{internship.company_name}</p>
        </div>
      </div>

      {/* Internship Info Card */}
      <div className="card mb-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <p className="text-sm text-slate-500">Status</p>
            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
              internship.status === 'active' 
                ? 'bg-success-500/10 text-success-600' 
                : 'bg-slate-100 text-slate-500'
            }`}>
              {internship.status || 'Active'}
            </span>
          </div>
          <div>
            <p className="text-sm text-slate-500">Daily Hours</p>
            <p className="font-medium">{internship.daily_start_time} - {internship.daily_end_time}</p>
          </div>
          <div>
            <p className="text-sm text-slate-500">Duration</p>
            <p className="font-medium">
              {new Date(internship.start_date).toLocaleDateString()} - {new Date(internship.end_date).toLocaleDateString()}
            </p>
          </div>
          <div>
            <p className="text-sm text-slate-500">Payment</p>
            <p className="font-medium">
              {internship.is_paid ? `💰 ₹${internship.stipend_amount}/month` : 'Unpaid'}
            </p>
          </div>
        </div>
        {internship.description && (
          <div className="mt-4 pt-4 border-t">
            <p className="text-sm text-slate-600">{internship.description}</p>
          </div>
        )}
      </div>
      <div className="flex justify-between items-start">
  <div>
    <h1 className="text-2xl font-bold text-slate-800">{internship.name}</h1>
    <p className="text-sm text-slate-500">{internship.company_name}</p>
  </div>
  <div className="flex gap-2">
    <button
      onClick={handleDeleteInternship}
      className="btn-danger text-sm px-4 py-1.5"
    >
      Delete Internship
    </button>
  </div>
</div>

      {/* Students Section */}
      <div className="card">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold text-slate-800">
            Assigned Students ({students.length})
          </h2>
          <button
            onClick={() => setShowAssignModal(true)}
            className="btn-primary text-sm px-4 py-1.5"
            disabled={availableStudents.length === 0}
          >
            + Add Students
          </button>
        </div>

        {students.length === 0 ? (
          <p className="text-slate-400 text-center py-6">No students assigned yet</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="text-left py-2 px-3 text-slate-500 font-medium">Student ID</th>
                  <th className="text-left py-2 px-3 text-slate-500 font-medium">Name</th>
                  <th className="text-left py-2 px-3 text-slate-500 font-medium">Email</th>
                  <th className="text-left py-2 px-3 text-slate-500 font-medium">Assigned At</th>
                  <th className="text-left py-2 px-3 text-slate-500 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {students.map((student) => (
                  <tr key={student.id} className="border-b border-slate-100">
                    <td className="py-2 px-3 font-mono text-xs text-slate-500">
                      {student.student_id}
                    </td>
                    <td className="py-2 px-3 font-medium text-slate-700">{student.name}</td>
                    <td className="py-2 px-3 text-slate-600">{student.email}</td>
                    <td className="py-2 px-3 text-slate-500 text-xs">
                      {new Date(student.assigned_at).toLocaleDateString()}
                    </td>
                    <td className="py-2 px-3">
                      <button
                        onClick={() => handleRemoveStudent(student.id)}
                        className="text-danger-500 hover:text-danger-700 text-sm"
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Assign Students Modal */}
      {showAssignModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 max-w-2xl w-full max-h-[80vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-slate-800">Assign Students</h3>
              <button onClick={() => setShowAssignModal(false)} className="text-slate-400 hover:text-slate-600">
                ✕
              </button>
            </div>

            {message && (
              <div className={`p-3 rounded-lg mb-4 ${
                message.includes('✅') ? 'bg-success-50 text-success-700' : 'bg-danger-50 text-danger-700'
              }`}>
                {message}
              </div>
            )}

            {availableStudents.length === 0 ? (
              <p className="text-slate-400 text-center py-6">All students are already assigned to internships</p>
            ) : (
              <>
                <div className="border rounded-lg divide-y max-h-60 overflow-y-auto mb-4">
                  {availableStudents.map((student) => (
                    <label key={student.id} className="flex items-center gap-3 p-3 hover:bg-slate-50 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedStudents.includes(student.id)}
                        onChange={() => toggleStudentSelection(student.id)}
                        className="w-4 h-4 text-primary-600 rounded focus:ring-primary-500"
                      />
                      <div>
                        <span className="font-medium text-slate-700">{student.name}</span>
                        <span className="text-xs text-slate-400 ml-2">({student.student_id})</span>
                        <span className="text-xs text-slate-500 ml-2">{student.email}</span>
                      </div>
                    </label>
                  ))}
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-sm text-slate-500">
                    {selectedStudents.length} student(s) selected
                  </span>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setShowAssignModal(false)}
                      className="btn-secondary"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleAssignStudents}
                      className="btn-primary"
                    >
                      Assign Students
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ManagerInternshipDetail;