/**
 * Settings.tsx — Role-adaptive platform settings
 *
 * Tabs:
 *   Profile     — Name, avatar, contact, timezone
 *   Security    — Password, passkeys (WebAuthn), active sessions
 *   Preferences — Notifications, theme, language, study schedule
 *   Billing     — Plan, subscription, invoices (CEO/Admin)
 *   Advanced    — API keys, export data, danger zone (CEO only)
 */
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  User, Shield, Bell, CreditCard, Sliders,
  Mail, Phone, Globe, Sun, Moon, Volume2, VolumeX,
  LogOut, Trash2, Download, Key, Fingerprint,
  Check, ChevronRight, AlertTriangle, ExternalLink,
} from 'lucide-react';
import { clsx } from 'clsx';
import { useAppStore } from '@/stores/appStore';
import PasskeyManager from '@/pages/PasskeyManager';

// ─── Types ────────────────────────────────────────────────────────────────────

type Tab = 'profile' | 'security' | 'preferences' | 'billing' | 'advanced';

// ─── Toggle Switch ─────────────────────────────────────────────────────────────

function Toggle({ value, onChange, label, sub }: {
  value: boolean;
  onChange: (v: boolean) => void;
  label: string;
  sub?: string;
}) {
  return (
    <div className="flex items-center justify-between py-3">
      <div>
        <p className="text-sm font-medium text-white">{label}</p>
        {sub && <p className="text-xs text-surface-400 mt-0.5">{sub}</p>}
      </div>
      <button
        onClick={() => onChange(!value)}
        className={clsx(
          'relative w-11 h-6 rounded-full transition-colors duration-200 flex-shrink-0',
          value ? 'bg-primary-500' : 'bg-surface-600'
        )}
      >
        <span className={clsx(
          'absolute top-1 w-4 h-4 rounded-full bg-white transition-transform duration-200',
          value ? 'translate-x-6' : 'translate-x-1'
        )} />
      </button>
    </div>
  );
}

// ─── Profile Tab ──────────────────────────────────────────────────────────────

function ProfileTab({ role }: { role: string }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(role === 'ceo' ? 'Giri' : role === 'teacher' ? 'Ms. Priya' : 'Arjun S.');
  const [email, setEmail] = useState('user@example.com');
  const [phone, setPhone] = useState('+91 98765 43210');
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    setEditing(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Avatar */}
      <div className="flex items-center gap-4">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary-400 to-accent-400 flex items-center justify-center">
          <User className="w-8 h-8 text-white" />
        </div>
        <div>
          <p className="font-semibold text-white">{name}</p>
          <p className="text-sm text-surface-400 capitalize">{role}</p>
          <button className="text-xs text-primary-400 hover:text-primary-300 mt-1 transition-colors">
            Change photo
          </button>
        </div>
      </div>

      {/* Fields */}
      <div className="grid gap-4">
        {[
          { label: 'Display Name', value: name, onChange: setName, icon: User },
          { label: 'Email', value: email, onChange: setEmail, icon: Mail },
          { label: 'Phone / WhatsApp', value: phone, onChange: setPhone, icon: Phone },
        ].map(({ label, value, onChange, icon: Icon }) => (
          <div key={label}>
            <label className="text-xs text-surface-400 uppercase tracking-wider mb-1.5 block">{label}</label>
            <div className="relative">
              <Icon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-500" />
              <input
                type="text"
                value={value}
                onChange={e => { if (editing) onChange(e.target.value); }}
                readOnly={!editing}
                className={clsx(
                  'w-full pl-9 pr-4 py-2.5 rounded-xl text-sm transition-colors',
                  editing
                    ? 'bg-surface-700 border border-primary-500/50 text-white focus:outline-none focus:border-primary-500'
                    : 'bg-surface-800/50 border border-surface-700/50 text-surface-300 cursor-default'
                )}
              />
            </div>
          </div>
        ))}

        {/* Language / Timezone */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-surface-400 uppercase tracking-wider mb-1.5 block">Language</label>
            <div className="relative">
              <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-500" />
              <select
                disabled={!editing}
                className="w-full pl-9 pr-4 py-2.5 rounded-xl text-sm bg-surface-800/50 border border-surface-700/50 text-surface-300 appearance-none"
              >
                <option>English</option>
                <option>हिंदी (Hindi)</option>
                <option>தமிழ் (Tamil)</option>
                <option>తెలుగు (Telugu)</option>
              </select>
            </div>
          </div>
          <div>
            <label className="text-xs text-surface-400 uppercase tracking-wider mb-1.5 block">Timezone</label>
            <select
              disabled={!editing}
              className="w-full px-3 py-2.5 rounded-xl text-sm bg-surface-800/50 border border-surface-700/50 text-surface-300 appearance-none"
            >
              <option>IST (UTC+5:30)</option>
              <option>UTC</option>
              <option>PST (UTC-8)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        {editing ? (
          <>
            <button onClick={handleSave} className="btn-primary flex items-center gap-2">
              <Check className="w-4 h-4" /> Save Changes
            </button>
            <button onClick={() => setEditing(false)} className="btn-secondary">
              Cancel
            </button>
          </>
        ) : (
          <button onClick={() => setEditing(true)} className="btn-secondary">
            Edit Profile
          </button>
        )}
        {saved && (
          <span className="flex items-center gap-1 text-sm text-green-400">
            <Check className="w-4 h-4" /> Saved!
          </span>
        )}
      </div>
    </div>
  );
}

// ─── Security Tab ─────────────────────────────────────────────────────────────

function SecurityTab() {
  const [showPasskeys, setShowPasskeys] = useState(false);
  const [twoFA, setTwoFA] = useState(false);

  const sessions = [
    { device: 'Chrome on macOS', location: 'Mumbai, IN', time: 'Active now', current: true },
    { device: 'EduGenius Android App', location: 'Delhi, IN', time: '2 hours ago', current: false },
    { device: 'Safari on iPhone', location: 'Bangalore, IN', time: '3 days ago', current: false },
  ];

  return (
    <div className="space-y-6">
      {/* Password */}
      <div className="card-inner">
        <div className="flex items-center gap-3 mb-4">
          <Key className="w-5 h-5 text-primary-400" />
          <h3 className="font-semibold text-white">Password</h3>
        </div>
        <p className="text-sm text-surface-400 mb-4">Last changed 30 days ago</p>
        <button className="btn-secondary text-sm">Change Password</button>
      </div>

      {/* Passkeys */}
      <div className="card-inner">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <Fingerprint className="w-5 h-5 text-primary-400" />
            <div>
              <h3 className="font-semibold text-white">Passkeys</h3>
              <p className="text-xs text-surface-400">Face ID, Touch ID, Windows Hello</p>
            </div>
          </div>
          <button
            onClick={() => setShowPasskeys(!showPasskeys)}
            className="flex items-center gap-1.5 text-sm text-primary-400 hover:text-primary-300 transition-colors"
          >
            {showPasskeys ? 'Hide' : 'Manage'}
            <ChevronRight className={clsx('w-4 h-4 transition-transform', showPasskeys && 'rotate-90')} />
          </button>
        </div>
        <AnimatePresence>
          {showPasskeys && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <PasskeyManager userId="current-user" userEmail="user@example.com" userName="User" />
            </motion.div>
          )}
        </AnimatePresence>
        {!showPasskeys && (
          <p className="text-sm text-surface-400">
            Use biometric authentication for faster, more secure sign-in.
          </p>
        )}
      </div>

      {/* 2FA */}
      <div className="card-inner">
        <div className="flex items-center gap-3 mb-4">
          <Shield className="w-5 h-5 text-primary-400" />
          <h3 className="font-semibold text-white">Two-Factor Authentication</h3>
        </div>
        <Toggle
          value={twoFA}
          onChange={setTwoFA}
          label="Enable TOTP (Authenticator App)"
          sub="Use Google Authenticator, Authy, or similar"
        />
        {twoFA && (
          <div className="mt-3 p-3 rounded-xl bg-green-500/10 border border-green-500/20">
            <p className="text-sm text-green-400 flex items-center gap-2">
              <Check className="w-4 h-4" /> 2FA enabled. Scan the QR code in your authenticator app.
            </p>
          </div>
        )}
      </div>

      {/* Active Sessions */}
      <div className="card-inner">
        <div className="flex items-center gap-3 mb-4">
          <Globe className="w-5 h-5 text-primary-400" />
          <h3 className="font-semibold text-white">Active Sessions</h3>
        </div>
        <div className="space-y-3">
          {sessions.map((session, i) => (
            <div key={i} className="flex items-center justify-between py-2 border-b border-surface-700/40 last:border-0">
              <div>
                <p className="text-sm font-medium text-white">{session.device}</p>
                <p className="text-xs text-surface-400">{session.location} · {session.time}</p>
              </div>
              {session.current ? (
                <span className="text-xs px-2 py-0.5 rounded-full bg-green-500/10 text-green-400 border border-green-500/20">
                  Current
                </span>
              ) : (
                <button className="text-xs text-red-400 hover:text-red-300 transition-colors flex items-center gap-1">
                  <LogOut className="w-3 h-3" /> Revoke
                </button>
              )}
            </div>
          ))}
        </div>
        <button className="mt-3 text-sm text-red-400 hover:text-red-300 transition-colors flex items-center gap-1.5">
          <LogOut className="w-4 h-4" /> Sign out all other sessions
        </button>
      </div>
    </div>
  );
}

// ─── Preferences Tab ──────────────────────────────────────────────────────────

function PreferencesTab() {
  const [darkMode, setDarkMode] = useState(true);
  const [sounds, setSounds] = useState(true);
  const [emailNotifs, setEmailNotifs] = useState(true);
  const [pushNotifs, setPushNotifs] = useState(true);
  const [waNotifs, setWaNotifs] = useState(false);
  const [telegramNotifs, setTelegramNotifs] = useState(false);
  const [studyReminders, setStudyReminders] = useState(true);
  const [streakAlerts, setStreakAlerts] = useState(true);
  const [examCountdown, setExamCountdown] = useState(true);

  return (
    <div className="space-y-6">
      {/* Appearance */}
      <div className="card-inner">
        <h3 className="font-semibold text-white mb-4 flex items-center gap-2">
          <Sun className="w-4 h-4 text-yellow-400" /> Appearance
        </h3>
        <div className="grid grid-cols-2 gap-3">
          {[
            { label: 'Dark', icon: Moon, active: darkMode },
            { label: 'Light', icon: Sun, active: !darkMode },
          ].map(({ label, icon: Icon, active }) => (
            <button
              key={label}
              onClick={() => setDarkMode(label === 'Dark')}
              className={clsx(
                'flex items-center gap-2 px-4 py-3 rounded-xl border transition-all text-sm font-medium',
                active
                  ? 'bg-primary-500/20 border-primary-500/40 text-primary-300'
                  : 'bg-surface-800/50 border-surface-700/50 text-surface-400 hover:text-white'
              )}
            >
              <Icon className="w-4 h-4" /> {label}
            </button>
          ))}
        </div>
        <Toggle
          value={sounds}
          onChange={setSounds}
          label="Sound Effects"
          sub="UI sounds for actions and notifications"
        />
      </div>

      {/* Notifications */}
      <div className="card-inner">
        <h3 className="font-semibold text-white mb-1 flex items-center gap-2">
          <Bell className="w-4 h-4 text-primary-400" /> Notifications
        </h3>
        <p className="text-xs text-surface-500 mb-4">Choose how you want to be notified</p>

        <div className="space-y-1 divide-y divide-surface-700/30">
          <Toggle value={emailNotifs} onChange={setEmailNotifs} label="Email" sub="Digest, reminders, reports" />
          <Toggle value={pushNotifs} onChange={setPushNotifs} label="Push Notifications" sub="Browser / app alerts" />
          <Toggle value={waNotifs} onChange={setWaNotifs} label="WhatsApp" sub="Connect WhatsApp to enable" />
          <Toggle value={telegramNotifs} onChange={setTelegramNotifs} label="Telegram" sub="Connect Telegram to enable" />
        </div>
      </div>

      {/* Study Preferences */}
      <div className="card-inner">
        <h3 className="font-semibold text-white mb-1 flex items-center gap-2">
          <Sliders className="w-4 h-4 text-primary-400" /> Study Preferences
        </h3>
        <div className="space-y-1 divide-y divide-surface-700/30">
          <Toggle value={studyReminders} onChange={setStudyReminders} label="Daily Study Reminders" sub="Get nudged at your preferred time" />
          <Toggle value={streakAlerts} onChange={setStreakAlerts} label="Streak Alerts" sub="Don't break your streak!" />
          <Toggle value={examCountdown} onChange={setExamCountdown} label="Exam Countdown" sub="Daily countdown to your next exam" />
        </div>
      </div>
    </div>
  );
}

// ─── Billing Tab ─────────────────────────────────────────────────────────────

function BillingTab() {
  const plans = [
    { name: 'Free', price: '₹0', features: ['1 exam', '50 AI chats/month', 'Basic analytics'], current: false },
    { name: 'Starter', price: '₹499/mo', features: ['3 exams', '500 AI chats', 'All subjects', 'WhatsApp support'], current: true },
    { name: 'Pro', price: '₹999/mo', features: ['All exams', 'Unlimited AI chats', 'Parent portal', 'Live doubt sessions'], current: false },
  ];

  return (
    <div className="space-y-6">
      {/* Current Plan */}
      <div className="card-inner">
        <div className="flex items-center gap-3 mb-4">
          <CreditCard className="w-5 h-5 text-primary-400" />
          <div>
            <h3 className="font-semibold text-white">Current Plan</h3>
            <p className="text-xs text-surface-400">Starter — renews Feb 28, 2026</p>
          </div>
          <span className="ml-auto text-xs px-2.5 py-1 rounded-full bg-primary-500/20 text-primary-300 border border-primary-500/30 font-medium">
            Active
          </span>
        </div>
        <div className="grid grid-cols-3 gap-3 mt-4">
          {plans.map(plan => (
            <div
              key={plan.name}
              className={clsx(
                'p-4 rounded-xl border transition-all',
                plan.current
                  ? 'bg-primary-500/10 border-primary-500/40'
                  : 'bg-surface-800/50 border-surface-700/40 hover:border-surface-600'
              )}
            >
              <p className="font-semibold text-white text-sm">{plan.name}</p>
              <p className="text-primary-400 font-bold mt-1">{plan.price}</p>
              <ul className="mt-3 space-y-1.5">
                {plan.features.map(f => (
                  <li key={f} className="text-xs text-surface-400 flex items-start gap-1.5">
                    <Check className="w-3 h-3 text-green-400 mt-0.5 flex-shrink-0" /> {f}
                  </li>
                ))}
              </ul>
              {plan.current ? (
                <p className="text-xs text-primary-400 mt-3 font-medium">Current plan</p>
              ) : (
                <button className="mt-3 w-full text-xs py-1.5 rounded-lg bg-primary-500/20 text-primary-400 hover:bg-primary-500/30 transition-colors">
                  {plan.name === 'Free' ? 'Downgrade' : 'Upgrade'}
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Payment method */}
      <div className="card-inner">
        <h3 className="font-semibold text-white mb-3">Payment Method</h3>
        <div className="flex items-center gap-3 p-3 rounded-xl bg-surface-800/50 border border-surface-700/50">
          <div className="w-10 h-7 rounded bg-surface-700 flex items-center justify-center">
            <CreditCard className="w-4 h-4 text-surface-400" />
          </div>
          <div>
            <p className="text-sm font-medium text-white">•••• •••• •••• 4242</p>
            <p className="text-xs text-surface-400">Expires 12/27</p>
          </div>
          <button className="ml-auto text-xs text-primary-400 hover:text-primary-300 transition-colors">
            Update
          </button>
        </div>
        <p className="mt-3 text-xs text-surface-500 flex items-center gap-1.5">
          <ExternalLink className="w-3 h-3" />
          Payments processed securely via Razorpay / Stripe
        </p>
      </div>
    </div>
  );
}

// ─── Advanced Tab (CEO only) ──────────────────────────────────────────────────

function AdvancedTab() {
  const [dangerConfirm, setDangerConfirm] = useState('');

  return (
    <div className="space-y-6">
      {/* API Access */}
      <div className="card-inner">
        <h3 className="font-semibold text-white mb-3 flex items-center gap-2">
          <Key className="w-4 h-4 text-primary-400" /> API Access
        </h3>
        <p className="text-sm text-surface-400 mb-4">
          Use these keys to integrate EduGenius into your own systems.
        </p>
        <div className="flex gap-2">
          <input
            readOnly
            value="eg_sk_live_••••••••••••••••••••"
            className="flex-1 px-3 py-2.5 rounded-xl bg-surface-800 border border-surface-700/50 text-sm text-surface-300 font-mono"
          />
          <button className="btn-secondary text-sm">Reveal</button>
          <button className="btn-secondary text-sm">Rotate</button>
        </div>
      </div>

      {/* Data Export */}
      <div className="card-inner">
        <h3 className="font-semibold text-white mb-3 flex items-center gap-2">
          <Download className="w-4 h-4 text-primary-400" /> Export Data
        </h3>
        <p className="text-sm text-surface-400 mb-4">
          Download all your platform data. Available in JSON or CSV format.
        </p>
        <div className="flex gap-3">
          <button className="btn-secondary text-sm flex items-center gap-2">
            <Download className="w-4 h-4" /> Export JSON
          </button>
          <button className="btn-secondary text-sm flex items-center gap-2">
            <Download className="w-4 h-4" /> Export CSV
          </button>
        </div>
      </div>

      {/* Danger Zone */}
      <div className="card-inner border border-red-500/20">
        <h3 className="font-semibold text-red-400 mb-3 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4" /> Danger Zone
        </h3>
        <div className="space-y-4">
          <div className="flex items-center justify-between py-3 border-b border-surface-700/40">
            <div>
              <p className="text-sm font-medium text-white">Reset All Data</p>
              <p className="text-xs text-surface-400">Wipe all student and content data. Irreversible.</p>
            </div>
            <button className="btn-secondary text-sm border-red-500/30 text-red-400 hover:bg-red-500/10">
              Reset
            </button>
          </div>
          <div className="flex items-center justify-between py-3">
            <div>
              <p className="text-sm font-medium text-white">Delete Account</p>
              <p className="text-xs text-surface-400">Permanently delete your account and all data.</p>
            </div>
            <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm bg-red-500/10 border border-red-500/30 text-red-400 hover:bg-red-500/20 transition-colors">
              <Trash2 className="w-3.5 h-3.5" /> Delete
            </button>
          </div>
          {dangerConfirm && (
            <div className="mt-2 p-3 rounded-xl bg-red-500/10 border border-red-500/30">
              <p className="text-sm text-red-300">Type <strong>DELETE</strong> to confirm:</p>
              <input
                value={dangerConfirm}
                onChange={e => setDangerConfirm(e.target.value)}
                className="mt-2 w-full px-3 py-2 rounded-lg bg-surface-800 border border-red-500/40 text-sm text-white"
                placeholder="Type DELETE to confirm"
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main Settings Page ───────────────────────────────────────────────────────

export default function Settings() {
  const { userRole } = useAppStore();
  const [activeTab, setActiveTab] = useState<Tab>('profile');

  const tabs: { id: Tab; label: string; icon: typeof User; roles?: string[] }[] = [
    { id: 'profile', label: 'Profile', icon: User },
    { id: 'security', label: 'Security', icon: Shield },
    { id: 'preferences', label: 'Preferences', icon: Bell },
    { id: 'billing', label: 'Billing', icon: CreditCard, roles: ['ceo', 'admin'] },
    { id: 'advanced', label: 'Advanced', icon: Sliders, roles: ['ceo'] },
  ];

  const visibleTabs = tabs.filter(t => !t.roles || t.roles.includes(userRole));

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Settings</h1>
        <p className="text-surface-400 text-sm mt-1">Manage your account, security and preferences</p>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 p-1 bg-surface-800/50 rounded-xl border border-surface-700/50">
        {visibleTabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={clsx(
              'flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all',
              activeTab === tab.id
                ? 'bg-primary-500/20 text-primary-300 border border-primary-500/30'
                : 'text-surface-400 hover:text-white hover:bg-surface-700/50'
            )}
          >
            <tab.icon className="w-4 h-4" />
            <span className="hidden sm:inline">{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Tab content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.15 }}
        >
          {activeTab === 'profile' && <ProfileTab role={userRole} />}
          {activeTab === 'security' && <SecurityTab />}
          {activeTab === 'preferences' && <PreferencesTab />}
          {activeTab === 'billing' && <BillingTab />}
          {activeTab === 'advanced' && <AdvancedTab />}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
