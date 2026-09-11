import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { io } from 'socket.io-client';
import './styles.css';
const API = import.meta.env.VITE_API_URL || (import.meta.env.DEV ? 'http://localhost:3001' : window.location.origin);
const socket = io(API, { autoConnect: true });
const seedChats = [
    { id: '1', name: 'Sarah Thompson', role: 'MP · Winnipeg North', online: true, initials: 'ST', preview: 'Why did you choose the hospital project?', time: '7:18 PM', unread: 2 },
    { id: '2', name: 'Michael Chen', role: 'Resident · Winnipeg', online: false, initials: 'MC', preview: 'See my proposal about the school...', time: '6:42 PM', unread: 0 },
    { id: '3', name: 'David Miller', role: 'Councillor · River Heights', online: true, initials: 'DM', preview: 'Thank you for participating.', time: '5:03 PM', unread: 0 }
];
const seedPoliticians = [
    { id: 'pol1', name: 'Sarah Thompson', title: 'Member of Parliament', office: 'MP', party: 'Independent', city: 'Winnipeg', province: 'Manitoba', district: 'Winnipeg North', initials: 'ST', verified: true },
    { id: 'pol2', name: 'David Miller', title: 'City Councillor', office: 'Councillor', party: 'Civic', city: 'Winnipeg', province: 'Manitoba', district: 'River Heights', initials: 'DM', verified: true },
    { id: 'pol3', name: 'Avery Morgan', title: 'Member of the Legislative Assembly', office: 'MLA', party: 'Independent', city: 'Brandon', province: 'Manitoba', district: 'Brandon East', initials: 'AM', verified: true },
    { id: 'pol4', name: 'Daniel Brooks', title: 'Mayor', office: 'Mayor', party: 'Civic', city: 'Winnipeg', province: 'Manitoba', district: 'Citywide', initials: 'DB', verified: true }
];
const seedChannels = [
    { id: 'c1', name: 'Sarah Thompson • Official', handle: '@sarahthompson', type: 'politician', members: '18.4K members', initials: 'ST', verified: true, about: 'Official channel of Sarah Thompson, MP for Winnipeg North.', tags: ['Winnipeg North', 'Healthcare', 'Schools'], posts: [
            { id: 'p1', author: 'Sarah Thompson', time: '2h', text: 'The hospital renovation vote is now closed. Thank you to everyone who participated.', meta: '9.8K views · 2.1K reactions', tags: ['Healthcare'], replies: 86 },
            { id: 'p2', author: 'Sarah Thompson', time: '5h', text: 'Tomorrow I will publish the full vote breakdown and the next steps for the project.', meta: '7.4K views · 1.6K reactions', tags: ['Winnipeg North', 'Schools'], replies: 41 }
        ] },
    { id: 'c2', name: 'Winnipeg Civic News', handle: '@wpgcivicnews', type: 'news', members: '42.7K members', initials: 'WN', verified: true, about: 'Independent local reporting, explainers and verified public-interest news.', tags: ['News', 'Winnipeg'], posts: [
            { id: 'p3', author: 'Winnipeg Civic News', time: '28m', text: 'City council will debate the 2027 school infrastructure budget next week. Here is what is on the table.', meta: '12.5K views · 842 reactions', tags: ['Schools', 'Taxes'], replies: 63 },
            { id: 'p4', author: 'Winnipeg Civic News', time: '3h', text: 'New public spending dashboard lets residents track capital projects by neighbourhood.', meta: '18.1K views · 1.9K reactions', tags: ['Taxes', 'Transparency'], replies: 122 }
        ] },
    { id: 'c3', name: 'Fix Winnipeg Transit', handle: '@fixwpgtransit', type: 'issue', members: '8.2K members', initials: 'FT', verified: false, about: 'Community channel about buses, schedules, accessibility and transit funding.', tags: ['Transit', 'Winnipeg'], posts: [
            { id: 'p5', author: 'Fix Winnipeg Transit', time: '41m', text: 'What is the single biggest transit problem in your neighbourhood? Share your route and the issue below.', meta: '6.2K views · 734 reactions', tags: ['Transit'], replies: 211 },
            { id: 'p6', author: 'Fix Winnipeg Transit', time: '1d', text: 'Community proposal: ask councillors to publish route reliability by corridor every month.', meta: '9.7K views · 1.2K reactions', tags: ['Transit', 'Government'], replies: 95 }
        ] },
    { id: 'c4', name: 'Winnipeg Budget 2027', handle: '@wpgbudget2027', type: 'issue', members: '3.9K members', initials: 'WB', verified: false, about: 'Public discussion channel for the 2027 municipal budget.', tags: ['Taxes', 'Budget', 'Winnipeg'], posts: [
            { id: 'p7', author: 'Winnipeg Budget 2027', time: '3h', text: 'Should the city prioritize road repairs or recreation centres? Post your arguments before the public vote.', meta: '4.3K views · 512 reactions', tags: ['Taxes', 'Infrastructure'], replies: 74 }
        ] }
];
const seedGroups = [
    { id: 'g1', name: 'Winnipeg Transit Discussion', handle: '@transitdiscussion', members: '2.8K members', initials: 'WT', about: 'Open community group for transit problems, ideas and local coordination.', tags: ['Transit', 'Winnipeg', 'Public services'], messages: [
            { id: 'gm1', from: 'Alex Rivera', initials: 'AR', role: 'Resident · St. James', time: '7:21 PM', text: 'Route 19 has been late three days in a row. Anyone else seeing this?' },
            { id: 'gm2', from: 'Maya Singh', initials: 'MS', role: 'Resident · West End', time: '7:24 PM', text: 'Yes. I think reliability data should be published by route every month.' },
            { id: 'gm3', from: 'John Doe', initials: 'JD', role: 'Citizen', time: '7:26 PM', text: 'That could make a strong public proposal for a city councillor.' }
        ] },
    { id: 'g2', name: 'School Repair Community', handle: '@schoolrepair', members: '1.4K members', initials: 'SR', about: 'Residents, parents and educators discussing school infrastructure priorities.', tags: ['Schools', 'Infrastructure', 'Winnipeg'], messages: [
            { id: 'gm4', from: 'Emma Patel', initials: 'EP', role: 'Resident', time: '6:02 PM', text: 'Which schools need the most urgent repairs this year?' },
            { id: 'gm5', from: 'Noah Brooks', initials: 'NB', role: 'Resident', time: '6:11 PM', text: 'Westview Elementary has had the same roof issue all winter.' }
        ] }
];
const seedTrends = [
    { id: 't1', author: 'Sarah Thompson', badge: 'Politician', time: '14m', initials: 'ST', text: 'I am opening a public question on hospital funding. What should be prioritized next?', tags: ['Healthcare', 'Winnipeg North'], views: '18.3K', replies: 402, likes: 2400, source: 'Sarah Thompson • Official' },
    { id: 't2', author: 'Winnipeg Civic News', badge: 'Independent News', time: '28m', initials: 'WN', text: 'City council will debate school infrastructure spending next week. Here are the five projects with the largest requests.', tags: ['Schools', 'Taxes'], views: '22.1K', replies: 188, likes: 1900, source: 'Winnipeg Civic News' },
    { id: 't3', author: 'Maya Singh', badge: 'Citizen', time: '37m', initials: 'MS', text: 'A simple proposal: publish monthly route reliability data for every bus line.', tags: ['Transit', 'Transparency'], views: '8.6K', replies: 97, likes: 1200, source: 'Winnipeg Transit Discussion' },
    { id: 't4', author: 'David Miller', badge: 'Politician', time: '1h', initials: 'DM', text: 'I want residents of River Heights to vote on whether our next capital request should focus on roads or parks.', tags: ['River Heights', 'Budget'], views: '10.7K', replies: 133, likes: 1600, source: 'David Miller • Official' }
];
const typeMeta = {
    politician: { label: 'POLITICIAN CHANNEL', icon: '🏛', desc: 'Official updates from a serving politician.' },
    news: { label: 'INDEPENDENT NEWS', icon: '📰', desc: 'News and public-interest reporting.' },
    issue: { label: 'ISSUE CHANNEL', icon: '📌', desc: 'Broadcast updates about a specific public issue.' }
};
function Avatar({ initials, large = false, online = false, type = '' }) {
    return React.createElement("div", { className: `avatar ${large ? 'large' : ''} ${type}` },
        initials,
        React.createElement("span", { className: `presence ${online ? 'online' : ''}` }));
}
function TagRow({ tags = [], compact = false }) {
    return React.createElement("div", { className: `tag-row ${compact ? 'compact' : ''}` }, tags.map(tag => React.createElement("span", { className: "tag-chip", key: tag },
        "#",
        tag)));
}
function QrVisual({ seed }) {
    const cells = useMemo(() => {
        let x = 0;
        return Array.from({ length: 121 }, (_, i) => { x = (x * 1664525 + seed.charCodeAt(i % seed.length) + 1013904223) % 4294967296; return ((x >>> 28) & 1) === 1; });
    }, [seed]);
    const finder = new Set([0, 1, 2, 3, 4, 5, 6, 10, 16, 17, 18, 19, 20, 21, 22, 24, 30, 36, 37, 38, 39, 40, 41, 42, 60, 61, 62, 63, 64, 65, 66, 70, 76, 82, 83, 84, 85, 86, 87, 88]);
    return React.createElement("div", { className: "qr-visual", "aria-label": "Rotating contact QR code" }, cells.map((on, i) => React.createElement("span", { key: i, className: on || finder.has(i) ? 'on' : '' })));
}
function App() {
    const [authMode, setAuthMode] = useState(() => {
        try {
            return localStorage.getItem('vox_token') ? 'app' : 'welcome';
        }
        catch {
            return 'welcome';
        }
    });
    const [accountTypeChoice, setAccountTypeChoice] = useState('');
    const [loginDraft, setLoginDraft] = useState({ identifier: '', password: '' });
    const [authError, setAuthError] = useState('');
    const [section, setSection] = useState('messages');
    const [chats, setChats] = useState(seedChats);
    const [selectedId, setSelectedId] = useState('1');
    const [text, setText] = useState('');
    const [channelFilter, setChannelFilter] = useState('all');
    const [selectedChannelId, setSelectedChannelId] = useState('c1');
    const [channels, setChannels] = useState(seedChannels);
    const [groups, setGroups] = useState(seedGroups);
    const [selectedGroupId, setSelectedGroupId] = useState('g1');
    const [groupText, setGroupText] = useState('');
    const [showCreate, setShowCreate] = useState(null);
    const [newItem, setNewItem] = useState({ name: '', handle: '', type: 'politician', description: '', tags: '' });
    const [channelPost, setChannelPost] = useState('');
    const [contactMode, setContactMode] = useState('politicians');
    const [politicianQuery, setPoliticianQuery] = useState('');
    const [politicianCity, setPoliticianCity] = useState('');
    const [politicianProvince, setPoliticianProvince] = useState('Manitoba');
    const [politicianOffice, setPoliticianOffice] = useState('All offices');
    const [nearbyVisible, setNearbyVisible] = useState(false);
    const [qrSeed, setQrSeed] = useState(Date.now().toString());
    const [trendTag, setTrendTag] = useState('All');
    const [showProfile, setShowProfile] = useState(false);
    const [showSettings, setShowSettings] = useState(false);
    const [profile, setProfile] = useState(() => {
        try {
            return JSON.parse(localStorage.getItem('vox_profile')) || {
                name: 'John Doe', handle: 'johndoe', type: 'Voter', city: 'Winnipeg', province: 'Manitoba',
                role: '', bio: 'Citizen on Vox Mandate.',
                messaging: 'everyone', friendRequests: 'qr', readReceipts: true, typingIndicators: true, messageNotifications: true
            };
        }
        catch {
            return { name: 'John Doe', handle: 'johndoe', type: 'Voter', city: 'Winnipeg', province: 'Manitoba', role: '', bio: 'Citizen on Vox Mandate.', messaging: 'everyone', friendRequests: 'qr', readReceipts: true, typingIndicators: true, messageNotifications: true };
        }
    });
    const [draftProfile, setDraftProfile] = useState(profile);
    const [settingsDraft, setSettingsDraft] = useState(profile);
    const [profileInitialized, setProfileInitialized] = useState(() => { try {
        return Boolean(localStorage.getItem('vox_profile_created'));
    }
    catch {
        return false;
    } });
    const [messages, setMessages] = useState({
        '1': [
            { id: 'm1', from: 'them', text: 'Why did you choose the hospital project?', time: '7:15 PM' },
            { id: 'm2', from: 'me', text: 'I wanted to explain the decision directly. The public vote gave the hospital option the stronger mandate.', time: '7:16 PM' },
            { id: 'm3', from: 'them', text: 'That makes sense. Can you publish the vote breakdown too?', time: '7:18 PM' }
        ],
        '2': [{ id: 'm4', from: 'them', text: 'See my proposal about the school budget.', time: '6:42 PM' }],
        '3': [{ id: 'm5', from: 'them', text: 'Thank you for participating.', time: '5:03 PM' }]
    });
    const selected = useMemo(() => chats.find(c => c.id === selectedId), [chats, selectedId]);
    const selectedChannel = useMemo(() => channels.find(c => c.id === selectedChannelId), [channels, selectedChannelId]);
    const visibleChannels = useMemo(() => channelFilter === 'all' ? channels : channels.filter(c => c.type === channelFilter), [channels, channelFilter]);
    const selectedGroup = useMemo(() => groups.find(g => g.id === selectedGroupId), [groups, selectedGroupId]);
    const politicians = useMemo(() => seedPoliticians.filter(p => {
        const q = politicianQuery.trim().toLowerCase();
        return (!q || `${p.name} ${p.title} ${p.district}`.toLowerCase().includes(q)) && (!politicianCity || p.city === politicianCity) && (!politicianProvince || p.province === politicianProvince) && (politicianOffice === 'All offices' || p.office === politicianOffice);
    }), [politicianQuery, politicianCity, politicianProvince, politicianOffice]);
    const trends = useMemo(() => trendTag === 'All' ? seedTrends : seedTrends.filter(t => t.tags.includes(trendTag)), [trendTag]);
    const trendTags = ['All', 'Transit', 'Healthcare', 'Schools', 'Taxes', 'Transparency', 'Budget'];
    useEffect(() => {
        if (section !== 'messages' || !selectedId)
            return;
        socket.emit('join', { conversationId: selectedId, userId: 'citizen-demo' });
    }, [selectedId, section]);
    useEffect(() => {
        const onMessage = message => {
            if (message.conversationId !== selectedId)
                return;
            setMessages(prev => ({ ...prev, [selectedId]: [...(prev[selectedId] || []), message] }));
        };
        socket.on('message:new', onMessage);
        return () => socket.off('message:new', onMessage);
    }, [selectedId]);
    useEffect(() => {
        let cancelled = false;
        const token = localStorage.getItem('vox_token');
        if (!token) {
            setAuthMode('welcome');
            return () => { cancelled = true; };
        }
        fetch(`${API}/api/auth/me`, { headers: { Authorization: `Bearer ${token}` } })
            .then(async (r) => {
            const data = await r.json().catch(() => ({}));
            if (!r.ok)
                throw new Error(data.error || 'Session expired.');
            return data;
        })
            .then(data => {
            if (!cancelled && data?.profile) {
                setProfile(data.profile);
                setDraftProfile(data.profile);
                setSettingsDraft(data.profile);
                setProfileInitialized(true);
                localStorage.setItem('vox_profile', JSON.stringify(data.profile));
                localStorage.setItem('vox_profile_created', '1');
                setAuthMode('app');
            }
        })
            .catch(() => {
            if (!cancelled) {
                localStorage.removeItem('vox_token');
                localStorage.removeItem('vox_session');
                localStorage.removeItem('vox_profile');
                localStorage.removeItem('vox_profile_created');
                setProfileInitialized(false);
                setAuthMode('welcome');
            }
        });
        return () => { cancelled = true; };
    }, []);
    useEffect(() => {
        const timer = setInterval(() => setQrSeed(Date.now().toString()), 15000);
        return () => clearInterval(timer);
    }, []);
    useEffect(() => {
        setDraftProfile(profile);
        setSettingsDraft(profile);
    }, [profile]);
    function selectSection(next) {
        setSection(next);
        if (next === 'contacts')
            setContactMode('politicians');
    }
    function sendMessage(e) {
        e.preventDefault();
        const value = text.trim();
        if (!value)
            return;
        const message = { id: crypto.randomUUID(), conversationId: selectedId, from: 'me', text: value, time: new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) };
        setMessages(prev => ({ ...prev, [selectedId]: [...(prev[selectedId] || []), message] }));
        socket.emit('message:send', { ...message, userId: 'citizen-demo' });
        setText('');
    }
    function searchChats(e) {
        const q = e.target.value.toLowerCase();
        setChats(seedChats.filter(c => `${c.name} ${c.role}`.toLowerCase().includes(q)));
    }
    function createItem(e) {
        e.preventDefault();
        const name = newItem.name.trim();
        if (!name)
            return;
        const cleanHandle = (newItem.handle || name).trim().toLowerCase().replace(/[^a-z0-9]+/g, '').replace(/^@+/, '');
        const initials = name.split(/\s+/).slice(0, 2).map(x => x[0]).join('').toUpperCase();
        const tags = newItem.tags.split(',').map(x => x.trim()).filter(Boolean).slice(0, 8);
        if (showCreate === 'channel') {
            const channel = { id: `c${Date.now()}`, name, handle: `@${cleanHandle}`, type: newItem.type, members: '1 member', initials, verified: false, about: newItem.description.trim() || 'New Vox Mandate channel.', tags, posts: [] };
            setChannels(prev => [channel, ...prev]);
            setSelectedChannelId(channel.id);
            setSection('channels');
        }
        else {
            const group = { id: `g${Date.now()}`, name, handle: `@${cleanHandle}`, members: '1 member', initials, about: newItem.description.trim() || 'New public discussion group.', tags, messages: [] };
            setGroups(prev => [group, ...prev]);
            setSelectedGroupId(group.id);
            setSection('groups');
        }
        setShowCreate(null);
        setNewItem({ name: '', handle: '', type: 'politician', description: '', tags: '' });
    }
    function publishChannelPost(e) {
        e.preventDefault();
        const value = channelPost.trim();
        if (!value || !selectedChannel)
            return;
        const post = { id: `p${Date.now()}`, author: profile.name, time: 'now', text: value, meta: '0 views · 0 reactions', tags: [], replies: 0 };
        setChannels(prev => prev.map(c => c.id === selectedChannel.id ? { ...c, posts: [post, ...c.posts] } : c));
        setChannelPost('');
    }
    function sendGroupMessage(e) {
        e.preventDefault();
        const value = groupText.trim();
        if (!value || !selectedGroup)
            return;
        const message = { id: `gm${Date.now()}`, from: profile.name, initials: initialsForProfile(), role: profile.type, time: new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }), text: value };
        setGroups(prev => prev.map(g => g.id === selectedGroup.id ? { ...g, messages: [...g.messages, message] } : g));
        setGroupText('');
    }
    function openPoliticianChat(p) {
        const existing = seedChats.find(c => c.name === p.name);
        if (existing) {
            setChats(prev => prev.some(c => c.id === existing.id) ? prev : [existing, ...prev]);
            setSelectedId(existing.id);
        }
        else {
            const next = { id: `chat-${p.id}`, name: p.name, role: `${p.office} · ${p.district}`, online: true, initials: p.initials, preview: 'Start a direct conversation…', time: 'now', unread: 0 };
            setChats(prev => [next, ...prev]);
            setSelectedId(next.id);
            setMessages(prev => ({ ...prev, [next.id]: [] }));
        }
        setSection('messages');
    }
    function simulateNearby() {
        setNearbyVisible(true);
        setTimeout(() => setNearbyVisible(false), 7000);
    }
    function chooseAccountType(type) {
        setAccountTypeChoice(type);
        setAuthError('');
        const defaults = {
            voter: { type: 'Voter', role: '', bio: 'Citizen on Vox Mandate.' },
            candidate: { type: 'Candidate', role: 'Candidate', bio: 'Candidate on Vox Mandate.' },
            politician: { type: 'Serving Politician', role: 'Serving politician', bio: 'Serving politician on Vox Mandate.' }
        };
        setDraftProfile({ ...profile, ...defaults[type] });
        setAuthMode('create-form');
    }
    function startLogin() {
        setAuthError('');
        setAuthMode('login');
    }
    async function handleLogin(e) {
        e.preventDefault();
        setAuthError('');
        if (!loginDraft.identifier.trim() || !loginDraft.password.trim()) {
            setAuthError('Enter your username or email and password.');
            return;
        }
        try {
            const response = await fetch(`${API}/api/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(loginDraft)
            });
            const data = await response.json().catch(() => ({}));
            if (!response.ok)
                throw new Error(data.error || 'Unable to log in.');
            localStorage.setItem('vox_token', data.token);
            localStorage.setItem('vox_profile', JSON.stringify(data.profile));
            localStorage.setItem('vox_profile_created', '1');
            localStorage.setItem('vox_session', JSON.stringify({ identifier: data.profile.handle, loggedInAt: Date.now() }));
            setProfile(data.profile);
            setDraftProfile(data.profile);
            setSettingsDraft(data.profile);
            setProfileInitialized(true);
            setLoginDraft({ identifier: '', password: '' });
            setAuthMode('app');
        }
        catch (error) {
            setAuthError(error.message || 'Incorrect username/email or password.');
        }
    }
    function beginAccountCreation() {
        setAuthError('');
        setAccountTypeChoice('');
        setAuthMode('account-type');
    }
    async function createAccount(e) {
        e.preventDefault();
        setAuthError('');
        const clean = {
            ...draftProfile,
            name: (draftProfile.name || '').trim(),
            handle: (draftProfile.handle || draftProfile.name || '').trim().toLowerCase().replace(/^@+/, '').replace(/[^a-z0-9_]+/g, '').slice(0, 24),
            email: (draftProfile.email || '').trim().toLowerCase(),
            password: draftProfile.password || '',
            bio: (draftProfile.bio || '').trim().slice(0, 180),
        };
        if (!clean.name || !clean.handle || !clean.email || !clean.password || !clean.city || !clean.province) {
            setAuthError('Please complete all required fields.');
            return;
        }
        if (clean.password.length < 8) {
            setAuthError('Password must be at least 8 characters.');
            return;
        }
        try {
            const response = await fetch(`${API}/api/auth/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(clean)
            });
            const data = await response.json().catch(() => ({}));
            if (!response.ok)
                throw new Error(data.error || 'Unable to create account.');
            localStorage.setItem('vox_token', data.token);
            localStorage.setItem('vox_profile', JSON.stringify(data.profile));
            localStorage.setItem('vox_profile_created', '1');
            localStorage.setItem('vox_session', JSON.stringify({ identifier: data.profile.handle, loggedInAt: Date.now() }));
            setProfile(data.profile);
            setDraftProfile(data.profile);
            setSettingsDraft(data.profile);
            setProfileInitialized(true);
            setAuthError('');
            setAuthMode('app');
        }
        catch (error) {
            setAuthError(error.message || 'Unable to create account.');
        }
    }
    async function saveProfile(e) {
        e.preventDefault();
        setAuthError('');
        const clean = {
            ...draftProfile,
            name: draftProfile.name.trim() || 'Vox User',
            handle: (draftProfile.handle || draftProfile.name).trim().toLowerCase().replace(/^@+/, '').replace(/[^a-z0-9_]+/g, '').slice(0, 24),
            bio: (draftProfile.bio || '').trim().slice(0, 180),
        };
        try {
            const token = localStorage.getItem('vox_token');
            const response = await fetch(`${API}/api/profile/me`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify(clean)
            });
            const data = await response.json().catch(() => ({}));
            if (!response.ok)
                throw new Error(data.error || 'Unable to save profile.');
            setProfile(data.profile);
            setDraftProfile(data.profile);
            setSettingsDraft(data.profile);
            localStorage.setItem('vox_profile', JSON.stringify(data.profile));
            setShowProfile(false);
        }
        catch (error) {
            setAuthError(error.message || 'Unable to save profile.');
        }
    }
    async function saveSettings(e) {
        e.preventDefault();
        const merged = { ...profile, ...settingsDraft };
        setProfile(merged);
        localStorage.setItem('vox_profile', JSON.stringify(merged));
        try {
            const token = localStorage.getItem('vox_token');
            const response = await fetch(`${API}/api/profile/me`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify(merged)
            });
            const data = await response.json().catch(() => ({}));
            if (!response.ok)
                throw new Error(data.error || 'Unable to save settings.');
            setProfile(data.profile);
            setSettingsDraft(data.profile);
            localStorage.setItem('vox_profile', JSON.stringify(data.profile));
            setShowSettings(false);
        }
        catch (error) {
            setAuthError(error.message || 'Unable to save settings.');
        }
    }
    function initialsForProfile() {
        return (profile.name || 'V U').split(/\s+/).slice(0, 2).map(x => x[0]).join('').toUpperCase();
    }
    return (React.createElement("div", { className: "app-shell" },
        React.createElement("aside", { className: "sidebar" },
            React.createElement("div", { className: "brand" },
                React.createElement("div", { className: "brand-mark" }, "V"),
                React.createElement("div", null,
                    React.createElement("strong", null, "VOX MANDATE"),
                    React.createElement("span", null, "Your Voice. Their Mandate."))),
            React.createElement("div", { className: "primary-nav" },
                React.createElement("button", { className: `nav-btn nav-parent ${['messages', 'channels', 'groups'].includes(section) ? 'active' : ''}`, onClick: () => selectSection(['messages', 'channels', 'groups'].includes(section) ? section : 'messages') },
                    React.createElement("span", null, "\u25A6"),
                    "Communication"),
                React.createElement("button", { className: `nav-btn nav-parent ${section === 'contacts' ? 'active' : ''}`, onClick: () => selectSection('contacts') },
                    React.createElement("span", null, "\u25CE"),
                    "People"),
                React.createElement("button", { className: `nav-btn nav-parent ${section === 'trends' ? 'active' : ''}`, onClick: () => selectSection('trends') },
                    React.createElement("span", null, "\u2726"),
                    "Trending")),
            ['messages', 'channels', 'groups'].includes(section) && React.createElement(React.Fragment, null,
                React.createElement("div", { className: "side-search" },
                    React.createElement("span", null, "\u2315"),
                    React.createElement("input", { placeholder: "Search chats", onChange: searchChats })),
                React.createElement("div", { className: "local-nav" }, [
                    ['messages', '▣', 'Messages'],
                    ['channels', '◫', 'Channels'],
                    ['groups', '◉', 'Groups']
                ].map(([id, icon, label]) => React.createElement("button", { key: id, className: `local-nav-btn ${section === id ? 'active' : ''}`, onClick: () => selectSection(id) },
                    React.createElement("span", null, icon),
                    label)))),
            section === 'messages' && React.createElement(React.Fragment, null,
                React.createElement("div", { className: "section-title" }, "DIRECT MESSAGES"),
                React.createElement("div", { className: "chat-list pinned-list" }, chats.map(chat => React.createElement("button", { key: chat.id, className: `chat-row ${selectedId === chat.id ? 'active' : ''}`, onClick: () => setSelectedId(chat.id) },
                    React.createElement(Avatar, { initials: chat.initials, online: chat.online }),
                    React.createElement("div", { className: "chat-meta" },
                        React.createElement("div", { className: "chat-top" },
                            React.createElement("strong", null, chat.name),
                            React.createElement("span", null, chat.time)),
                        React.createElement("div", { className: "role" }, chat.role),
                        React.createElement("div", { className: "preview" }, chat.preview)),
                    chat.unread > 0 && React.createElement("span", { className: "unread" }, chat.unread))))),
            section === 'channels' && React.createElement(React.Fragment, null,
                React.createElement("div", { className: "section-toolbar" },
                    React.createElement("div", { className: "section-title no-pad" }, "PUBLIC CHANNELS"),
                    React.createElement("button", { className: "create-btn", onClick: () => setShowCreate('channel') }, "\uFF0B Create")),
                React.createElement("div", { className: "filter-scroll" }, ['all', 'politician', 'news', 'issue'].map(f => React.createElement("button", { key: f, className: `filter-chip ${channelFilter === f ? 'active' : ''}`, onClick: () => setChannelFilter(f) }, f === 'all' ? 'All' : typeMeta[f].label))),
                React.createElement("div", { className: "chat-list" }, visibleChannels.map(channel => React.createElement("button", { key: channel.id, className: `chat-row ${selectedChannelId === channel.id ? 'active' : ''}`, onClick: () => setSelectedChannelId(channel.id) },
                    React.createElement(Avatar, { initials: channel.initials, type: `channel-avatar ${channel.type}` }),
                    React.createElement("div", { className: "chat-meta" },
                        React.createElement("div", { className: "chat-top" },
                            React.createElement("strong", null, channel.name)),
                        React.createElement("div", { className: "role" }, typeMeta[channel.type].label),
                        React.createElement("div", { className: "preview" },
                            channel.members,
                            " \u00B7 ",
                            channel.about),
                        React.createElement(TagRow, { tags: channel.tags, compact: true })))))),
            section === 'groups' && React.createElement(React.Fragment, null,
                React.createElement("div", { className: "section-toolbar" },
                    React.createElement("div", { className: "section-title no-pad" }, "PUBLIC GROUPS"),
                    React.createElement("button", { className: "create-btn", onClick: () => setShowCreate('group') }, "\uFF0B Create")),
                React.createElement("div", { className: "group-info-card" },
                    React.createElement("strong", null, "Groups are conversational."),
                    React.createElement("span", null, "Every member can post, reply and share ideas.")),
                React.createElement("div", { className: "chat-list" }, groups.map(group => React.createElement("button", { key: group.id, className: `chat-row ${selectedGroupId === group.id ? 'active' : ''}`, onClick: () => setSelectedGroupId(group.id) },
                    React.createElement(Avatar, { initials: group.initials, type: "issue" }),
                    React.createElement("div", { className: "chat-meta" },
                        React.createElement("div", { className: "chat-top" },
                            React.createElement("strong", null, group.name)),
                        React.createElement("div", { className: "role" }, "PUBLIC GROUP"),
                        React.createElement("div", { className: "preview" },
                            group.members,
                            " \u00B7 ",
                            group.about),
                        React.createElement(TagRow, { tags: group.tags, compact: true })))))),
            section === 'contacts' && React.createElement(React.Fragment, null,
                React.createElement("div", { className: "section-toolbar" },
                    React.createElement("div", { className: "section-title no-pad" }, "PEOPLE")),
                React.createElement("div", { className: "local-nav single" },
                    React.createElement("button", { className: "local-nav-btn active" },
                        React.createElement("span", null, "\u25CE"),
                        "Contacts")),
                React.createElement("div", { className: "contact-tabs" },
                    React.createElement("button", { className: contactMode === 'politicians' ? 'active' : '', onClick: () => setContactMode('politicians') }, "Politicians"),
                    React.createElement("button", { className: contactMode === 'friends' ? 'active' : '', onClick: () => setContactMode('friends') }, "Friends")),
                contactMode === 'politicians' ? React.createElement("div", { className: "contact-side-copy" },
                    React.createElement("strong", null, "Find representatives"),
                    React.createElement("span", null, "Search by name, city, province or office.")) : React.createElement("div", { className: "contact-side-copy" },
                    React.createElement("strong", null, "Find friends privately"),
                    React.createElement("span", null, "Use QR or discover people physically nearby."))),
            section === 'trends' && React.createElement(React.Fragment, null,
                React.createElement("div", { className: "section-toolbar" },
                    React.createElement("div", { className: "section-title no-pad" }, "TRENDING")),
                React.createElement("div", { className: "filter-scroll" }, trendTags.map(tag => React.createElement("button", { key: tag, className: `filter-chip ${trendTag === tag ? 'active' : ''}`, onClick: () => setTrendTag(tag) }, tag === 'All' ? 'All' : `#${tag}`))),
                React.createElement("div", { className: "trend-side-note" },
                    React.createElement("strong", null, "What\u2019s happening now"),
                    React.createElement("span", null, "Posts gaining attention across politicians, channels and citizens."))),
            React.createElement("div", { className: "sidebar-footer" },
                React.createElement("div", { className: "profile-mini" },
                    React.createElement("button", { className: "profile-click", onClick: () => { setDraftProfile(profile); setShowProfile(true); } },
                        React.createElement(Avatar, { initials: initialsForProfile() }),
                        React.createElement("div", null,
                            React.createElement("strong", null, profile.name),
                            React.createElement("span", null, profile.type))),
                    React.createElement("button", { "aria-label": "Settings", className: "settings-trigger", onClick: () => { setSettingsDraft(profile); setShowSettings(true); } }, "\u2699")))),
        React.createElement("main", { className: "main-pane" },
            section === 'messages' && selected && React.createElement(React.Fragment, null,
                React.createElement("header", { className: "topbar" },
                    React.createElement("div", { className: "person" },
                        React.createElement(Avatar, { initials: selected.initials, online: selected.online }),
                        React.createElement("div", null,
                            React.createElement("h1", null, selected.name),
                            React.createElement("p", null,
                                selected.role,
                                " \u00B7 ",
                                selected.online ? 'Online now' : 'Offline'))),
                    React.createElement("div", { className: "header-actions" },
                        React.createElement("button", { className: "ghost-btn" }, "View profile"),
                        React.createElement("button", { className: "icon-btn" }, "\u22EF"))),
                React.createElement("div", { className: "scroll-area" },
                    React.createElement("div", { className: "date-divider" },
                        React.createElement("span", null, "Today")),
                    React.createElement("div", { className: "mandate-card" },
                        React.createElement("span", { className: "status-dot" }),
                        React.createElement("div", null,
                            React.createElement("strong", null, "Direct citizen conversation"),
                            React.createElement("p", null, "Messages here are private between you and this representative."))),
                    React.createElement("div", { className: "messages" }, (messages[selectedId] || []).map(m => React.createElement("div", { key: m.id, className: `message-row ${m.from === 'me' ? 'mine' : ''}` },
                        React.createElement("div", { className: `bubble ${m.from === 'me' ? 'mine' : ''}` },
                            m.text,
                            React.createElement("div", { className: "message-time" }, m.time)))))),
                React.createElement("form", { className: "composer", onSubmit: sendMessage },
                    React.createElement("button", { type: "button", className: "attach" }, "\uFF0B"),
                    React.createElement("textarea", { value: text, onChange: e => setText(e.target.value), onKeyDown: e => { if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            sendMessage(e);
                        } }, rows: "1", placeholder: `Message ${selected.name}...` }),
                    React.createElement("button", { className: "send", type: "submit" }, "\u27A4"))),
            section === 'channels' && selectedChannel && React.createElement(React.Fragment, null,
                React.createElement("header", { className: "topbar" },
                    React.createElement("div", { className: "channel-identity" },
                        React.createElement(Avatar, { initials: selectedChannel.initials, type: `channel-avatar ${selectedChannel.type}`, large: true }),
                        React.createElement("div", null,
                            React.createElement("div", { className: "eyebrow" }, typeMeta[selectedChannel.type].label),
                            React.createElement("h1", null, selectedChannel.name),
                            React.createElement("p", null,
                                selectedChannel.handle,
                                " \u00B7 ",
                                selectedChannel.members))),
                    React.createElement("div", { className: "header-actions" },
                        React.createElement("button", { className: "follow-btn" }, "Following"),
                        React.createElement("button", { className: "icon-btn" }, "\u22EF"))),
                React.createElement("div", { className: "scroll-area content-area" },
                    React.createElement("div", { className: "channel-cover" },
                        React.createElement("div", null,
                            React.createElement("strong", null, selectedChannel.about),
                            React.createElement("p", null, "Broadcast channel \u00B7 owner publishes \u00B7 followers can react, share and open discussions."),
                            React.createElement(TagRow, { tags: selectedChannel.tags }))),
                    React.createElement("div", { className: "channel-feed" }, selectedChannel.posts.map(post => React.createElement("article", { className: "post-card", key: post.id },
                        React.createElement("div", { className: "post-top" },
                            React.createElement(Avatar, { initials: selectedChannel.initials }),
                            React.createElement("div", null,
                                React.createElement("strong", null, post.author),
                                React.createElement("div", { className: "post-meta" },
                                    post.time,
                                    " \u00B7 ",
                                    selectedChannel.members.replace(' members', ''))),
                            React.createElement("span", { className: "post-type-pill" }, typeMeta[selectedChannel.type].label)),
                        React.createElement("p", null, post.text),
                        React.createElement(TagRow, { tags: post.tags }),
                        React.createElement("div", { className: "post-footer" },
                            React.createElement("span", null,
                                "\u2661 ",
                                post.meta.split(' · ')[1]?.replace('reactions', '')),
                            React.createElement("span", null,
                                "\u25CC ",
                                post.meta.split(' · ')[0]),
                            React.createElement("button", { className: "link-btn" },
                                "\uD83D\uDCAC ",
                                post.replies || 0),
                            React.createElement("button", { className: "link-btn" }, "\u2197 Share")))))),
                React.createElement("div", { className: "bottom-composer" }, selectedChannel.type === 'politician' ? React.createElement("form", { className: "owner-post-row", onSubmit: publishChannelPost },
                    React.createElement("textarea", { rows: "1", value: channelPost, onChange: e => setChannelPost(e.target.value), placeholder: "Publish an update to this channel..." }),
                    React.createElement("button", { className: "send wide", type: "submit" }, "Post")) : React.createElement("div", { className: "readonly-note" },
                    React.createElement("strong", null, "Read-only broadcast"),
                    React.createElement("span", null, "Followers can react, share and open a discussion."),
                    React.createElement("button", { className: "ghost-btn" }, "Open discussion")))),
            section === 'groups' && selectedGroup && React.createElement(React.Fragment, null,
                React.createElement("header", { className: "topbar" },
                    React.createElement("div", { className: "channel-identity" },
                        React.createElement(Avatar, { initials: selectedGroup.initials, type: "issue", large: true }),
                        React.createElement("div", null,
                            React.createElement("div", { className: "eyebrow" }, "PUBLIC GROUP \u00B7 OPEN DISCUSSION"),
                            React.createElement("h1", null, selectedGroup.name),
                            React.createElement("p", null,
                                selectedGroup.handle,
                                " \u00B7 ",
                                selectedGroup.members))),
                    React.createElement("div", { className: "header-actions" },
                        React.createElement("button", { className: "follow-btn" }, "Joined"),
                        React.createElement("button", { className: "icon-btn" }, "\u22EF"))),
                React.createElement("div", { className: "scroll-area content-area" },
                    React.createElement("div", { className: "group-cover" },
                        React.createElement("div", null,
                            React.createElement("strong", null, selectedGroup.about),
                            React.createElement("p", null, "Everyone in this group can start a conversation, reply and share proposals."),
                            React.createElement(TagRow, { tags: selectedGroup.tags })),
                        React.createElement("span", { className: "permission-pill" }, "Members can post")),
                    React.createElement("div", { className: "group-feed" }, selectedGroup.messages.map(m => React.createElement("div", { className: `group-message ${m.from === 'John Doe' ? 'own' : ''}`, key: m.id },
                        React.createElement(Avatar, { initials: m.initials }),
                        React.createElement("div", { className: "group-message-content" },
                            React.createElement("div", { className: "group-message-head" },
                                React.createElement("strong", null, m.from),
                                React.createElement("span", null,
                                    m.role,
                                    " \u00B7 ",
                                    m.time)),
                            React.createElement("div", { className: "group-bubble" }, m.text),
                            React.createElement("div", { className: "group-actions" },
                                React.createElement("button", { className: "link-btn" }, "Reply"),
                                React.createElement("button", { className: "link-btn" }, "React"),
                                React.createElement("button", { className: "link-btn" }, "Share"))))))),
                React.createElement("form", { className: "composer", onSubmit: sendGroupMessage },
                    React.createElement("button", { type: "button", className: "attach" }, "\uFF0B"),
                    React.createElement("textarea", { value: groupText, onChange: e => setGroupText(e.target.value), onKeyDown: e => { if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            sendGroupMessage(e);
                        } }, rows: "1", placeholder: `Message ${selectedGroup.name}...` }),
                    React.createElement("button", { className: "send", type: "submit" }, "\u27A4"))),
            section === 'contacts' && React.createElement("div", { className: "scroll-area content-area contacts-page" },
                React.createElement("div", { className: "page-heading" },
                    React.createElement("div", null,
                        React.createElement("div", { className: "eyebrow" }, "DISCOVER"),
                        React.createElement("h2", null, "Contacts"),
                        React.createElement("p", null, "Find politicians by public information, or add friends without exposing your phone number publicly."))),
                React.createElement("div", { className: "contact-content-tabs" },
                    React.createElement("button", { className: contactMode === 'politicians' ? 'active' : '', onClick: () => setContactMode('politicians') }, "Politicians"),
                    React.createElement("button", { className: contactMode === 'friends' ? 'active' : '', onClick: () => setContactMode('friends') }, "Friends")),
                contactMode === 'politicians' ? React.createElement(React.Fragment, null,
                    React.createElement("div", { className: "search-panel" },
                        React.createElement("div", { className: "search-main" },
                            React.createElement("span", null, "\u2315"),
                            React.createElement("input", { value: politicianQuery, onChange: e => setPoliticianQuery(e.target.value), placeholder: "Search politician by name or district" })),
                        React.createElement("select", { value: politicianCity, onChange: e => setPoliticianCity(e.target.value) },
                            React.createElement("option", { value: "" }, "Any city"),
                            React.createElement("option", null, "Winnipeg"),
                            React.createElement("option", null, "Brandon")),
                        React.createElement("select", { value: politicianProvince, onChange: e => setPoliticianProvince(e.target.value) },
                            React.createElement("option", { value: "" }, "Any province"),
                            React.createElement("option", null, "Manitoba")),
                        React.createElement("select", { value: politicianOffice, onChange: e => setPoliticianOffice(e.target.value) },
                            React.createElement("option", null, "All offices"),
                            React.createElement("option", null, "MP"),
                            React.createElement("option", null, "MLA"),
                            React.createElement("option", null, "Councillor"),
                            React.createElement("option", null, "Mayor"))),
                    React.createElement("div", { className: "contact-grid" }, politicians.map(p => React.createElement("article", { className: "contact-card", key: p.id },
                        React.createElement("div", { className: "contact-card-head" },
                            React.createElement(Avatar, { initials: p.initials, large: true }),
                            React.createElement("div", null,
                                React.createElement("strong", null, p.name),
                                React.createElement("span", null, p.title),
                                React.createElement("small", null,
                                    p.city,
                                    ", ",
                                    p.province,
                                    " \u00B7 ",
                                    p.district)),
                            React.createElement("span", { className: "verified" }, "\u2713")),
                        React.createElement("div", { className: "contact-card-meta" },
                            React.createElement("span", null, p.party),
                            React.createElement("span", null, p.office)),
                        React.createElement("button", { className: "primary-action", onClick: () => openPoliticianChat(p) }, "Message")))),
                    politicians.length === 0 && React.createElement("div", { className: "empty-card" }, "No politicians match these filters.")) : React.createElement(React.Fragment, null,
                    React.createElement("div", { className: "friend-tools" },
                        React.createElement("article", { className: "friend-card" },
                            React.createElement("div", null,
                                React.createElement("div", { className: "eyebrow" }, "PRIVATE ADD"),
                                React.createElement("h3", null, "Scan a friend\u2019s QR"),
                                React.createElement("p", null, "The code rotates every 15 seconds, so an old screenshot quickly becomes useless.")),
                            React.createElement("button", { className: "ghost-btn", onClick: () => setQrSeed(Date.now().toString()) }, "Refresh code"),
                            React.createElement(QrVisual, { seed: qrSeed })),
                        React.createElement("article", { className: "friend-card nearby-card" },
                            React.createElement("div", null,
                                React.createElement("div", { className: "eyebrow" }, "NEARBY"),
                                React.createElement("h3", null, "Find people near you"),
                                React.createElement("p", null, "Use a short-lived proximity handshake instead of searching by name.")),
                            React.createElement("button", { className: "primary-action", onClick: simulateNearby }, "Scan nearby phones"),
                            nearbyVisible && React.createElement("div", { className: "nearby-results" },
                                React.createElement("div", null,
                                    React.createElement(Avatar, { initials: "LM" }),
                                    React.createElement("span", null,
                                        React.createElement("strong", null, "Lucas Martin"),
                                        React.createElement("small", null, "8 m away \u00B7 mutual interest: Transit")),
                                    React.createElement("button", { className: "link-btn" }, "Add")),
                                React.createElement("div", null,
                                    React.createElement(Avatar, { initials: "KP" }),
                                    React.createElement("span", null,
                                        React.createElement("strong", null, "Karen Patel"),
                                        React.createElement("small", null, "15 m away \u00B7 mutual interest: Schools")),
                                    React.createElement("button", { className: "link-btn" }, "Add"))))))),
            section === 'trends' && React.createElement("div", { className: "scroll-area content-area trends-page" },
                React.createElement("div", { className: "page-heading" },
                    React.createElement("div", null,
                        React.createElement("div", { className: "eyebrow" }, "THE PUBLIC FEED"),
                        React.createElement("h2", null, "Trending"),
                        React.createElement("p", null, "One place for fast-moving public conversations: politicians, news channels and citizen posts."))),
                React.createElement("div", { className: "trend-filters" }, trendTags.map(tag => React.createElement("button", { key: tag, className: `filter-chip ${trendTag === tag ? 'active' : ''}`, onClick: () => setTrendTag(tag) }, tag === 'All' ? 'All' : `#${tag}`))),
                React.createElement("div", { className: "trend-feed" }, trends.map(t => React.createElement("article", { className: "trend-card", key: t.id },
                    React.createElement("div", { className: "trend-head" },
                        React.createElement(Avatar, { initials: t.initials }),
                        React.createElement("div", null,
                            React.createElement("strong", null, t.author),
                            React.createElement("span", null,
                                t.badge,
                                " \u00B7 ",
                                t.time)),
                        React.createElement("button", { className: "icon-btn" }, "\u22EF")),
                    React.createElement("p", null, t.text),
                    React.createElement(TagRow, { tags: t.tags }),
                    React.createElement("div", { className: "trend-source" },
                        "From ",
                        React.createElement("strong", null, t.source)),
                    React.createElement("div", { className: "post-footer" },
                        React.createElement("span", null,
                            "\u2661 ",
                            t.likes),
                        React.createElement("span", null,
                            "\u25CC ",
                            t.views),
                        React.createElement("span", null,
                            "\uD83D\uDCAC ",
                            t.replies),
                        React.createElement("button", { className: "link-btn" }, "\u2197 Share"))))))),
        showProfile && authMode === 'app' && React.createElement("div", { className: "modal-backdrop", onMouseDown: () => setShowProfile(false) },
            React.createElement("form", { className: "modal profile-modal", onSubmit: saveProfile, onMouseDown: e => e.stopPropagation() },
                React.createElement("div", { className: "modal-head" },
                    React.createElement("div", null,
                        React.createElement("div", { className: "eyebrow" }, "YOUR PROFILE"),
                        React.createElement("h2", null, "Edit your profile"),
                        React.createElement("p", null, "Update how other people see you and how they can contact you.")),
                    React.createElement("button", { type: "button", className: "icon-btn", onClick: () => setShowProfile(false) }, "\u00D7")),
                React.createElement("div", { className: "profile-preview" },
                    React.createElement(Avatar, { initials: (draftProfile.name || 'VU').split(/\s+/).slice(0, 2).map(x => x[0]).join('').toUpperCase(), large: true }),
                    React.createElement("div", null,
                        React.createElement("strong", null, draftProfile.name || 'Your name'),
                        React.createElement("span", null,
                            "@",
                            draftProfile.handle || 'username'),
                        React.createElement("small", { className: "account-pill" }, draftProfile.type))),
                React.createElement("div", { className: "profile-grid" },
                    React.createElement("label", null,
                        "Display name",
                        React.createElement("input", { value: draftProfile.name, onChange: e => setDraftProfile({ ...draftProfile, name: e.target.value }), placeholder: "John Doe", autoFocus: true })),
                    React.createElement("label", null,
                        "Username",
                        React.createElement("input", { value: draftProfile.handle, onChange: e => setDraftProfile({ ...draftProfile, handle: e.target.value }), placeholder: "johndoe" })),
                    React.createElement("label", null,
                        "Account type",
                        React.createElement("select", { value: draftProfile.type, onChange: e => setDraftProfile({ ...draftProfile, type: e.target.value }) },
                            React.createElement("option", null, "Voter"),
                            React.createElement("option", null, "Candidate"),
                            React.createElement("option", null, "Serving Politician"))),
                    React.createElement("label", null,
                        "City",
                        React.createElement("input", { value: draftProfile.city, onChange: e => setDraftProfile({ ...draftProfile, city: e.target.value }), placeholder: "Winnipeg" })),
                    React.createElement("label", null,
                        "Province / State",
                        React.createElement("input", { value: draftProfile.province, onChange: e => setDraftProfile({ ...draftProfile, province: e.target.value }), placeholder: "Manitoba" })),
                    React.createElement("label", null,
                        "Role / title",
                        React.createElement("input", { value: draftProfile.role, onChange: e => setDraftProfile({ ...draftProfile, role: e.target.value }), placeholder: "MP, Councillor, Resident\u2026" }))),
                React.createElement("label", null,
                    "Bio",
                    React.createElement("textarea", { value: draftProfile.bio, onChange: e => setDraftProfile({ ...draftProfile, bio: e.target.value }), rows: "3", placeholder: "Tell people what you are here for\u2026" })),
                React.createElement("div", { className: "modal-actions" },
                    React.createElement("button", { type: "button", className: "ghost-btn", onClick: () => setShowProfile(false) }, "Cancel"),
                    React.createElement("button", { type: "submit", className: "send wide" }, "Save profile")))),
        authMode === 'welcome' && React.createElement("div", { className: "auth-screen" },
            React.createElement("div", { className: "auth-card" },
                React.createElement("div", { className: "auth-brand" },
                    React.createElement("div", { className: "brand-mark" }, "V"),
                    React.createElement("div", null,
                        React.createElement("div", { className: "auth-brand-title" }, "VOX MANDATE"),
                        React.createElement("div", { className: "auth-brand-tag" }, "Your voice. Their mandate."))),
                React.createElement("div", { className: "eyebrow" }, "WELCOME"),
                React.createElement("h1", null, "Join the public conversation."),
                React.createElement("p", { className: "auth-subtitle" }, "Create an account to follow politicians, join public groups, publish ideas and participate in votes."),
                React.createElement("div", { className: "auth-actions" },
                    React.createElement("button", { className: "send auth-primary", onClick: startLogin }, "Log in"),
                    React.createElement("button", { className: "ghost-btn auth-secondary", onClick: beginAccountCreation }, "Create an account")))),
        authMode === 'account-type' && React.createElement("div", { className: "auth-screen" },
            React.createElement("div", { className: "auth-card wide" },
                React.createElement("button", { className: "back-link", onClick: () => setAuthMode('welcome') }, "\u2190 Back"),
                React.createElement("div", { className: "eyebrow" }, "CREATE AN ACCOUNT"),
                React.createElement("h1", null, "Which describes you?"),
                React.createElement("p", { className: "auth-subtitle" }, "Choose your role first. We\u2019ll tailor the profile form to you."),
                React.createElement("div", { className: "account-choice-grid" },
                    React.createElement("button", { className: "account-choice", onClick: () => chooseAccountType('voter') },
                        React.createElement("span", { className: "choice-icon" }, "\u25C9"),
                        React.createElement("strong", null, "Voter"),
                        React.createElement("small", null, "For citizens and residents who want to participate, follow representatives and join discussions.")),
                    React.createElement("button", { className: "account-choice", onClick: () => chooseAccountType('candidate') },
                        React.createElement("span", { className: "choice-icon" }, "\u25CE"),
                        React.createElement("strong", null, "Candidate"),
                        React.createElement("small", null, "For people running for elected office and building public support before an election.")),
                    React.createElement("button", { className: "account-choice", onClick: () => chooseAccountType('politician') },
                        React.createElement("span", { className: "choice-icon" }, "\uD83C\uDFDB"),
                        React.createElement("strong", null, "Serving Politician"),
                        React.createElement("small", null, "For currently elected officials who represent a district or community."))))),
        authMode === 'create-form' && (React.createElement("div", { className: "auth-screen" },
            React.createElement("form", { className: "modal profile-modal auth-card form-card", onSubmit: createAccount },
                React.createElement("button", { type: "button", className: "back-link", onClick: () => setAuthMode('account-type') }, "\u2190 Back"),
                React.createElement("div", { className: "modal-head" },
                    React.createElement("div", null,
                        React.createElement("div", { className: "eyebrow" }, "CREATE YOUR PROFILE"),
                        React.createElement("h2", null, draftProfile.type === 'Voter'
                            ? 'Set up your voter profile'
                            : draftProfile.type === 'Candidate'
                                ? 'Set up your candidate profile'
                                : 'Set up your politician profile'),
                        React.createElement("p", null, "This is the information people will see on Vox Mandate."))),
                React.createElement("div", { className: "profile-preview" },
                    React.createElement(Avatar, { initials: (draftProfile.name || 'VU').split(/\s+/).slice(0, 2).map(x => x[0]).join('').toUpperCase(), large: true }),
                    React.createElement("div", null,
                        React.createElement("strong", null, draftProfile.name || 'Your name'),
                        React.createElement("span", null,
                            "@",
                            draftProfile.handle || 'username'),
                        React.createElement("small", { className: "account-pill" }, draftProfile.type))),
                React.createElement("div", { className: "profile-grid" },
                    React.createElement("label", null,
                        "Full name",
                        React.createElement("input", { value: draftProfile.name === 'John Doe' ? '' : draftProfile.name, onChange: e => setDraftProfile({ ...draftProfile, name: e.target.value }), placeholder: draftProfile.type === 'Voter' ? 'Your name' : 'Full legal name', required: true, autoFocus: true })),
                    React.createElement("label", null,
                        "Username",
                        React.createElement("input", { value: draftProfile.handle === 'johndoe' ? '' : draftProfile.handle, onChange: e => setDraftProfile({ ...draftProfile, handle: e.target.value }), placeholder: "username", required: true })),
                    React.createElement("label", null,
                        "Email",
                        React.createElement("input", { type: "email", value: draftProfile.email || '', onChange: e => setDraftProfile({ ...draftProfile, email: e.target.value }), placeholder: "you@example.com", required: true })),
                    React.createElement("label", null,
                        "Password",
                        React.createElement("input", { type: "password", value: draftProfile.password || '', onChange: e => setDraftProfile({ ...draftProfile, password: e.target.value }), placeholder: "Create a password", required: true })),
                    React.createElement("label", null,
                        "City",
                        React.createElement("input", { value: draftProfile.city, onChange: e => setDraftProfile({ ...draftProfile, city: e.target.value }), placeholder: "Winnipeg", required: true })),
                    React.createElement("label", null,
                        "Province / State",
                        React.createElement("input", { value: draftProfile.province, onChange: e => setDraftProfile({ ...draftProfile, province: e.target.value }), placeholder: "Manitoba", required: true })),
                    draftProfile.type !== 'Voter' && (React.createElement(React.Fragment, null,
                        React.createElement("label", null,
                            "Office / campaign role",
                            React.createElement("input", { value: draftProfile.role, onChange: e => setDraftProfile({ ...draftProfile, role: e.target.value }), placeholder: draftProfile.type === 'Candidate' ? 'Candidate for City Council' : 'MP, MLA, Mayor, Councillor…', required: true })),
                        React.createElement("label", null,
                            "District / riding",
                            React.createElement("input", { value: draftProfile.district || '', onChange: e => setDraftProfile({ ...draftProfile, district: e.target.value }), placeholder: "Winnipeg North" }))))),
                React.createElement("label", null,
                    "Bio",
                    React.createElement("textarea", { value: draftProfile.bio, onChange: e => setDraftProfile({ ...draftProfile, bio: e.target.value }), rows: "3", placeholder: "Tell people what you are here for\u2026" })),
                authError && React.createElement("div", { className: "auth-error" }, authError),
                React.createElement("div", { className: "modal-actions" },
                    React.createElement("button", { type: "button", className: "ghost-btn", onClick: () => setAuthMode('account-type') }, "Back"),
                    React.createElement("button", { type: "submit", className: "send wide" }, "Create account"))))),
        authMode === 'login' && React.createElement("div", { className: "auth-screen" },
            React.createElement("form", { className: "auth-card form-card", onSubmit: handleLogin },
                React.createElement("button", { type: "button", className: "back-link", onClick: () => setAuthMode('welcome') }, "\u2190 Back"),
                React.createElement("div", { className: "eyebrow" }, "WELCOME BACK"),
                React.createElement("h1", null, "Log in to Vox Mandate"),
                React.createElement("p", { className: "auth-subtitle" }, "Use your username or email to continue."),
                React.createElement("label", null,
                    "Username or email",
                    React.createElement("input", { autoFocus: true, value: loginDraft.identifier, onChange: e => setLoginDraft({ ...loginDraft, identifier: e.target.value }), placeholder: "you@example.com" })),
                React.createElement("label", null,
                    "Password",
                    React.createElement("input", { type: "password", value: loginDraft.password, onChange: e => setLoginDraft({ ...loginDraft, password: e.target.value }), placeholder: "Password" })),
                authError && React.createElement("div", { className: "auth-error" }, authError),
                React.createElement("div", { className: "modal-actions" },
                    React.createElement("button", { type: "submit", className: "send wide" }, "Log in")),
                React.createElement("button", { type: "button", className: "back-link centered", onClick: beginAccountCreation }, "Create a new account"))),
        showSettings && React.createElement("div", { className: "modal-backdrop", onMouseDown: () => setShowSettings(false) },
            React.createElement("form", { className: "modal settings-modal", onSubmit: saveSettings, onMouseDown: e => e.stopPropagation() },
                React.createElement("div", { className: "modal-head" },
                    React.createElement("div", null,
                        React.createElement("div", { className: "eyebrow" }, "COMMUNICATION SETTINGS"),
                        React.createElement("h2", null, "Control your conversations"),
                        React.createElement("p", null, "Choose who can message you, how friend requests work and which chat signals you share.")),
                    React.createElement("button", { type: "button", className: "icon-btn", onClick: () => setShowSettings(false) }, "\u00D7")),
                React.createElement("div", { className: "settings-list" },
                    React.createElement("div", { className: "setting-row" },
                        React.createElement("div", null,
                            React.createElement("strong", null, "Who can message you"),
                            React.createElement("span", null, "Control incoming direct messages.")),
                        React.createElement("select", { value: settingsDraft.messaging, onChange: e => setSettingsDraft({ ...settingsDraft, messaging: e.target.value }) },
                            React.createElement("option", { value: "everyone" }, "Everyone"),
                            React.createElement("option", { value: "following" }, "People you follow"),
                            React.createElement("option", { value: "nobody" }, "Nobody"))),
                    React.createElement("div", { className: "setting-row" },
                        React.createElement("div", null,
                            React.createElement("strong", null, "Friend requests"),
                            React.createElement("span", null, "Keep friend discovery QR-only by default.")),
                        React.createElement("select", { value: settingsDraft.friendRequests, onChange: e => setSettingsDraft({ ...settingsDraft, friendRequests: e.target.value }) },
                            React.createElement("option", { value: "qr" }, "QR code only"),
                            React.createElement("option", { value: "qr_nearby" }, "QR + Nearby"),
                            React.createElement("option", { value: "none" }, "Nobody"))),
                    [['readReceipts', 'Read receipts', 'Let people know when you have read a direct message.'], ['typingIndicators', 'Typing indicators', 'Show when you are typing in a direct chat.'], ['messageNotifications', 'Message notifications', 'Allow notifications for new direct messages.']].map(([key, title, desc]) => React.createElement("label", { className: "setting-toggle", key: key },
                        React.createElement("span", null,
                            React.createElement("strong", null, title),
                            React.createElement("small", null, desc)),
                        React.createElement("input", { type: "checkbox", checked: Boolean(settingsDraft[key]), onChange: e => setSettingsDraft({ ...settingsDraft, [key]: e.target.checked }) }),
                        React.createElement("i", null)))),
                React.createElement("div", { className: "settings-note" },
                    React.createElement("strong", null, "Good to know:"),
                    React.createElement("span", null, "These are local prototype preferences right now. Once accounts are connected to the backend, the same settings can be stored server-side and synced between devices.")),
                React.createElement("div", { className: "modal-actions" },
                    React.createElement("button", { type: "button", className: "ghost-btn", onClick: () => setShowSettings(false) }, "Cancel"),
                    React.createElement("button", { type: "submit", className: "send wide" }, "Save settings")))),
        showCreate && React.createElement("div", { className: "modal-backdrop", onMouseDown: () => setShowCreate(null) },
            React.createElement("form", { className: "modal", onSubmit: createItem, onMouseDown: e => e.stopPropagation() },
                React.createElement("div", { className: "modal-head" },
                    React.createElement("div", null,
                        React.createElement("div", { className: "eyebrow" },
                            "NEW ",
                            showCreate === 'channel' ? 'CHANNEL' : 'GROUP'),
                        React.createElement("h2", null, showCreate === 'channel' ? 'Create a public channel' : 'Create a public group'),
                        React.createElement("p", null, showCreate === 'channel' ? 'Channels broadcast updates. Followers read, react and discuss.' : 'Groups are open forums where members can post, reply and organize around an issue.')),
                    React.createElement("button", { type: "button", className: "icon-btn", onClick: () => setShowCreate(null) }, "\u00D7")),
                React.createElement("label", null,
                    "Name",
                    React.createElement("input", { value: newItem.name, onChange: e => setNewItem({ ...newItem, name: e.target.value }), placeholder: showCreate === 'channel' ? 'e.g. Sarah Thompson Official' : 'e.g. Winnipeg Transit Discussion', autoFocus: true })),
                React.createElement("label", null,
                    "Public handle",
                    React.createElement("input", { value: newItem.handle, onChange: e => setNewItem({ ...newItem, handle: e.target.value }), placeholder: "e.g. wpgtransit" })),
                React.createElement("label", null,
                    "Description",
                    React.createElement("input", { value: newItem.description, onChange: e => setNewItem({ ...newItem, description: e.target.value }), placeholder: "What is this space about?" })),
                React.createElement("label", null,
                    "Tags",
                    React.createElement("input", { value: newItem.tags, onChange: e => setNewItem({ ...newItem, tags: e.target.value }), placeholder: "e.g. Transit, Winnipeg, Taxes" })),
                showCreate === 'channel' && React.createElement("div", { className: "type-grid" }, Object.entries(typeMeta).map(([key, meta]) => React.createElement("button", { type: "button", key: key, className: `type-card ${newItem.type === key ? 'selected' : ''}`, onClick: () => setNewItem({ ...newItem, type: key }) },
                    React.createElement("span", { className: "type-icon" }, meta.icon),
                    React.createElement("strong", null, meta.label),
                    React.createElement("small", null, meta.desc)))),
                showCreate === 'group' && React.createElement("div", { className: "tag-help" },
                    React.createElement("strong", null, "Tags are chosen by the creator."),
                    React.createElement("span", null, "Use them for a school address, a government request, or broad topics like health, taxes, housing or transit.")),
                React.createElement("div", { className: "modal-actions" },
                    React.createElement("button", { type: "button", className: "ghost-btn", onClick: () => setShowCreate(null) }, "Cancel"),
                    React.createElement("button", { type: "submit", className: "send wide" },
                        "Create ",
                        showCreate))))));
}
createRoot(document.getElementById('root')).render(React.createElement(App, null));
