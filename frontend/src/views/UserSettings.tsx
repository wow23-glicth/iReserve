import React, { useState, useEffect } from 'react';
import { Users, Edit2, Trash2, Loader2, X, RefreshCw, UserPlus } from 'lucide-react';
import { supabase } from '../supabaseClient';

interface User {
  user_id: string;
  name: string;
  username: string;
  role: string;
}

const UserSettings: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Form states (Add User)
  const [addName, setAddName] = useState('');
  const [addUsername, setAddUsername] = useState('');
  const [addPassword, setAddPassword] = useState('');
  const [addRole, setAddRole] = useState('Cashier');
  const [adding, setAdding] = useState(false);

  // Form states (Edit Modal)
  const [editUser, setEditUser] = useState<User | null>(null);
  const [editName, setEditName] = useState('');
  const [editUsername, setEditUsername] = useState('');
  const [editRole, setEditRole] = useState('');
  const [editPassword, setEditPassword] = useState('');
  const [updating, setUpdating] = useState(false);

  const getErrorMessage = (err: any): string => {
    if (!err) return 'An unknown error occurred.';
    if (typeof err === 'string') return err;
    if (err.message && typeof err.message === 'string') return err.message;
    if (err.error_description && typeof err.error_description === 'string') return err.error_description;
    if (err.error && typeof err.error === 'string') return err.error;
    try {
      const str = JSON.stringify(err);
      return str === '{}' ? err.toString() || 'Object error' : str;
    } catch {
      return String(err);
    }
  };

  const fetchUsers = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: fetchError } = await supabase
        .from('profiles')
        .select('id, name, username, role')
        .order('name', { ascending: true });

      if (fetchError) throw fetchError;

      const usersList: User[] = (data || []).map((p: any) => ({
        user_id: p.id,
        name: p.name,
        username: p.username,
        role: p.role
      }));

      setUsers(usersList);
    } catch (err: any) {
      console.error(err);
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const showSuccess = (msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(null), 3000);
  };

  // ADD USER
  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdding(true);
    setError(null);
    setSuccessMsg(null);

    const email = addUsername.includes('@') ? addUsername.trim() : `${addUsername.trim()}@ireserve.local`;

    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
      
      const { createClient } = await import('@supabase/supabase-js');
      const tempSupabase = createClient(supabaseUrl, supabaseAnonKey, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false
        }
      });

      const { data: signUpData, error: signUpError } = await tempSupabase.auth.signUp({
        email: email,
        password: addPassword,
        options: {
          data: {
            name: addName.trim(),
            username: addUsername.trim(),
            role: addRole
          }
        }
      });

      if (signUpError) throw signUpError;
      if (!signUpData.user) throw new Error('No user data returned from authentication server.');

      // Wait a moment for trigger
      await new Promise((resolve) => setTimeout(resolve, 800));

      showSuccess(`Staff account for "${addName}" provisioned successfully.`);
      setAddName('');
      setAddUsername('');
      setAddPassword('');
      setAddRole('Cashier');
      
      fetchUsers();
    } catch (err: any) {
      console.error(err);
      setError(getErrorMessage(err));
    } finally {
      setAdding(false);
    }
  };

  // UPDATE USER
  const handleOpenEdit = (u: User) => {
    setEditUser(u);
    setEditName(u.name);
    setEditUsername(u.username);
    setEditRole(u.role);
    setEditPassword('');
  };

  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editUser) return;
    setUpdating(true);
    setError(null);

    try {
      // 1. If username changed, update email in auth.users via RPC
      if (editUsername.trim() !== editUser.username) {
        const { error: emailError } = await supabase.rpc('update_user_email', {
          user_uuid: editUser.user_id,
          new_username: editUsername.trim()
        });
        if (emailError) throw emailError;
      }

      // 2. Update Profile in public.profiles (Name, Username, Role)
      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          name: editName,
          username: editUsername.trim(),
          role: editRole
        })
        .eq('id', editUser.user_id);

      if (updateError) throw updateError;

      // 3. Update password via RPC if provided
      if (editPassword.trim()) {
        const { error: passwordError } = await supabase.rpc('update_user_password', {
          user_uuid: editUser.user_id,
          new_password: editPassword.trim()
        });
        if (passwordError) throw passwordError;
      }

      showSuccess('Account profile and credentials updated successfully.');
      setEditUser(null);
      fetchUsers();
    } catch (err: any) {
      console.error(err);
      setError(getErrorMessage(err));
    } finally {
      setUpdating(false);
    }
  };

  // DELETE USER
  const handleDeleteUser = async (userId: string, targetName: string) => {
    if (!confirm(`Permanently delete the user profile for "${targetName}"?`)) return;
    setError(null);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user && user.id === userId) {
        throw new Error('Cannot delete your own active administrator account.');
      }

      const { error: deleteError } = await supabase
        .from('profiles')
        .delete()
        .eq('id', userId);

      if (deleteError) throw deleteError;

      showSuccess('Account profile removed successfully.');
      fetchUsers();
    } catch (err: any) {
      console.error(err);
      setError(getErrorMessage(err));
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {error && <div className="ui-alert ui-alert-error">{error}</div>}
      {successMsg && <div className="ui-alert ui-alert-success">{successMsg}</div>}

      {/* ── ADD USER — Premium Form Grid ── */}
      <div className="glass-panel" style={{ padding: '2rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.25rem' }}>
          <UserPlus size={18} style={{ color: 'var(--primary)' }} />
          <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)' }}>Provision Staff Account</h3>
        </div>
        <form onSubmit={handleAddUser} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1.25rem', alignItems: 'end' }}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Full Name</label>
            <input
              type="text" className="form-input" placeholder="Name"
              value={addName} onChange={(e) => setAddName(e.target.value)} required
            />
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Username</label>
            <input
              type="text" className="form-input" placeholder="e.g. dice"
              value={addUsername} onChange={(e) => setAddUsername(e.target.value)} required
            />
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Temporary Password</label>
            <input
              type="password" className="form-input" placeholder="••••••••"
              value={addPassword} onChange={(e) => setAddPassword(e.target.value)} required
            />
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">System Role</label>
            <select className="form-select" value={addRole} onChange={(e) => setAddRole(e.target.value)} required>
              <option value="Admin">Admin</option>
              <option value="Manager">Manager</option>
              <option value="Cashier">Cashier</option>
            </select>
          </div>

          <button type="submit" className="btn btn-primary" disabled={adding} style={{ height: '46px' }}>
            {adding ? <Loader2 className="animate-spin" size={18} /> : 'Create Account'}
          </button>
        </form>
      </div>

      {/* ── ACCOUNTS LIST TABLE ── */}
      <div className="glass-panel" style={{ padding: '2rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Users size={18} style={{ color: 'var(--text-secondary)' }} />
            <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)' }}>Staff Registry</h3>
          </div>
          <button className="btn btn-secondary btn-sm" onClick={fetchUsers} style={{ gap: '0.4rem', height: '38px', borderRadius: '14px' }}>
            <RefreshCw size={14} /> Refresh Registry
          </button>
        </div>

        {loading && users.length === 0 ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem' }}>
            <Loader2 className="animate-spin" size={24} style={{ color: 'var(--primary)' }} />
          </div>
        ) : users.length > 0 ? (
          <div className="table-container">
            <table className="custom-table users-table">
              <thead>
                <tr>
                  <th>Full Name</th>
                  <th>Username / Email</th>
                  <th>System Role</th>
                  <th style={{ width: '150px', textAlign: 'center' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.user_id}>
                    <td><strong style={{ color: 'var(--text-primary)' }}>{u.name}</strong></td>
                    <td style={{ color: 'var(--text-secondary)' }}>{u.username}</td>
                    <td>
                      <span className={`badge ${
                        u.role === 'Admin' ? 'badge-danger' : 
                        u.role === 'Manager' ? 'badge-info' : 'badge-success'
                      }`}>
                        {u.role}
                      </span>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <div style={{ display: 'flex', gap: '0.4rem', justifyContent: 'center' }}>
                        <button 
                          className="btn btn-secondary btn-sm" 
                          onClick={() => handleOpenEdit(u)}
                          style={{ padding: '0.45rem' }}
                          title="Edit User Profile"
                        >
                          <Edit2 size={13} />
                        </button>
                        <button 
                          className="btn btn-sm"
                          onClick={() => handleDeleteUser(u.user_id, u.name)}
                          style={{ 
                            background: 'rgba(239,68,68,0.12)', 
                            color: 'var(--danger)', 
                            border: '1px solid rgba(239,68,68,0.22)',
                            padding: '0.45rem'
                          }}
                          title="Delete User"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '2rem 0' }}>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.92rem' }}>No user profiles found.</p>
          </div>
        )}
      </div>

      {/* ── EDIT USER MODAL ── */}
      {editUser && (
        <div className="modal-overlay">
          <div className="modal-content glass-panel">
            <div className="modal-header">
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700 }}>Edit User Profile</h3>
              <button className="modal-close" onClick={() => setEditUser(null)}><X size={20} /></button>
            </div>
            
            <form onSubmit={handleUpdateUser}>
              <div className="form-group">
                <label className="form-label">Full Name</label>
                <input type="text" className="form-input" value={editName} onChange={(e) => setEditName(e.target.value)} required />
              </div>

              <div className="form-group">
                <label className="form-label">Username / Email</label>
                <input type="text" className="form-input" value={editUsername} onChange={(e) => setEditUsername(e.target.value)} required />
              </div>

              <div className="form-group">
                <label className="form-label">New Password (leave blank to keep current)</label>
                <input 
                  type="password" 
                  className="form-input" 
                  placeholder="Enter new password"
                  value={editPassword} 
                  onChange={(e) => setEditPassword(e.target.value)} 
                />
              </div>

              <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                <label className="form-label">System Role</label>
                <select className="form-select" value={editRole} onChange={(e) => setEditRole(e.target.value)}>
                  <option value="Admin">Admin</option>
                  <option value="Manager">Manager</option>
                  <option value="Cashier">Cashier</option>
                </select>
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setEditUser(null)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={updating}>
                  {updating ? <Loader2 className="animate-spin" size={16} /> : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserSettings;
