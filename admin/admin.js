// admin/admin.js
import {
    getFirestore,
    collection,
    getDocs,
    doc,
    updateDoc,
    deleteDoc,
    query,
    onSnapshot,
    getCountFromServer,
    orderBy,
    limit,
    where,
    collectionGroup,
    getDoc
} from "https://www.gstatic.com/firebasejs/9.17.1/firebase-firestore.js";

document.addEventListener('DOMContentLoaded', () => {
    const db = getFirestore();

    // --- DOM Elements ---
    const loginContainer = document.getElementById('login-container');
    const adminPanel = document.getElementById('admin-panel');
    const loginForm = document.getElementById('admin-login-form');
    const loginError = document.getElementById('login-error');
    const logoutBtn = document.getElementById('admin-logout-btn');

    // Stats Elements
    const totalUsersStat = document.getElementById('total-users-stat');
    const totalGroupsStat = document.getElementById('total-groups-stat');
    const totalMessagesStat = document.getElementById('total-messages-stat');
    const reportedUsersStat = document.getElementById('reported-users-stat');

    // Table Containers
    const userManagementTable = document.getElementById('user-management-table');
    const reportedContentTable = document.getElementById('reported-content-table');

    // --- Modal Control ---
    const modal = {
        backdrop: document.getElementById('modal-backdrop'),
        title: document.getElementById('modal-title'),
        text: document.getElementById('modal-text'),
        confirmBtn: document.getElementById('modal-confirm-btn'),
        cancelBtn: document.getElementById('modal-cancel-btn'),
        _onConfirm: null,

        show: function({ title, text, confirmText, confirmClass, onConfirm }) {
            this.title.textContent = title;
            this.text.innerHTML = text; // Use innerHTML to support HTML content
            this.confirmBtn.textContent = confirmText;
            this.confirmBtn.className = `modal-btn ${confirmClass}`;
            this._onConfirm = onConfirm;
            this.backdrop.style.display = 'flex';
        },
        hide: function() {
            this.backdrop.style.display = 'none';
            this._onConfirm = null;
        }
    };
    modal.confirmBtn.addEventListener('click', () => {
        if (modal._onConfirm) modal._onConfirm();
    });
    modal.cancelBtn.addEventListener('click', () => modal.hide());


    // --- Authentication Logic ---
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const user = document.getElementById('admin-user').value;
        const pass = document.getElementById('admin-pass').value;
        loginError.textContent = ''; // Clear previous errors

        try {
            const response = await fetch('/api/admin-login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username: user, password: pass })
            });

            // Try to parse the JSON response body.
            let data;
            try {
                data = await response.json();
            } catch (jsonError) {
                // If the response isn't valid JSON, display a generic error.
                console.error('Failed to parse JSON from response:', jsonError);
                loginError.textContent = `An unexpected error occurred (Status: ${response.status}).`;
                return;
            }

            // Check for a successful response (HTTP 200-299) AND the success flag in the body.
            if (response.ok && data.success) {
                sessionStorage.setItem('adminAuthenticated', 'true');
                showAdminPanel();
            } else {
                // Use the message from the API, or a default message if none is provided.
                loginError.textContent = data.message || 'Invalid username or password.';
            }
        } catch (error) {
            // This catches network errors or other issues with the fetch call itself.
            console.error('Admin login fetch error:', error);
            loginError.textContent = 'Network error. Please check your connection.';
        }
    });

    logoutBtn.addEventListener('click', () => {
        cleanup();
        sessionStorage.removeItem('adminAuthenticated');
        showLogin();
    });

    function showAdminPanel() {
        loginContainer.style.display = 'none';
        adminPanel.style.display = 'block';
        loadAdminData();
    }

    function showLogin() {
        loginContainer.style.display = 'flex';
        adminPanel.style.display = 'none';
    }

    // Check session storage on page load
    if (sessionStorage.getItem('adminAuthenticated') === 'true') {
        showAdminPanel();
    } else {
        showLogin();
    }


    // --- Data Loading and Rendering ---
    let activeListeners = [];

    function loadAdminData() {
        // Clear any existing listeners
        activeListeners.forEach(unsubscribe => unsubscribe());
        activeListeners = [];

        // Load stats with real-time listeners
        const usersCol = collection(db, "users");
        const usersListener = onSnapshot(usersCol, (snapshot) => {
            totalUsersStat.textContent = snapshot.size;
            renderUserTable(snapshot);
        }, (error) => {
            console.error("Error loading users:", error);
            totalUsersStat.textContent = "Error";
        });
        activeListeners.push(usersListener);
        
        const chatsCol = collection(db, "chats");
        const chatsListener = onSnapshot(chatsCol, (snapshot) => {
            totalGroupsStat.textContent = snapshot.size;
        }, (error) => {
            console.error("Error loading chats:", error);
            totalGroupsStat.textContent = "Error";
        });
        activeListeners.push(chatsListener);

        const reportsCol = collection(db, "reports");
        const reportsListener = onSnapshot(reportsCol, (snapshot) => {
            reportedUsersStat.textContent = snapshot.size;
            renderReportsTable(snapshot);
        }, (error) => {
            console.error("Error loading reports:", error);
            reportedUsersStat.textContent = "Error";
        });
        activeListeners.push(reportsListener);

        // Load message count (this is more complex due to subcollections)
        loadMessageCount();
    }

    async function loadMessageCount() {
        try {
            // Get all chats first
            const chatsSnapshot = await getDocs(collection(db, "chats"));
            let totalMessages = 0;
            
            // For each chat, count messages in its subcollection
            const messageCountPromises = chatsSnapshot.docs.map(async (chatDoc) => {
                try {
                    const messagesSnapshot = await getDocs(collection(db, "chats", chatDoc.id, "messages"));
                    return messagesSnapshot.size;
                } catch (error) {
                    console.error(`Error counting messages for chat ${chatDoc.id}:`, error);
                    return 0;
                }
            });

            const messageCounts = await Promise.all(messageCountPromises);
            totalMessages = messageCounts.reduce((sum, count) => sum + count, 0);
            
            totalMessagesStat.textContent = totalMessages.toLocaleString();
        } catch (error) {
            console.error("Error loading message count:", error);
            totalMessagesStat.textContent = "Error";
        }
    }

    function renderUserTable(usersSnapshot) {
        let tableHTML = `
            <div class="table-controls">
                <input type="text" id="user-search" placeholder="Search users by name or email..." class="search-input">
                <select id="user-filter" class="filter-select">
                    <option value="all">All Users</option>
                    <option value="active">Active Only</option>
                    <option value="banned">Banned Only</option>
                    <option value="guest">Guest Accounts</option>
                    <option value="registered">Registered Accounts</option>
                </select>
            </div>
            <table>
                <thead>
                    <tr>
                        <th>User ID</th>
                        <th>Display Name</th>
                        <th>Email</th>
                        <th>Pronouns</th>
                        <th>Account Type</th>
                        <th>Join Date</th>
                        <th>Status</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody id="users-tbody">`;
        
        if (usersSnapshot.empty) {
            tableHTML += `<tr><td colspan="8">No users found.</td></tr>`;
        } else {
            const users = [];
            usersSnapshot.forEach(userDoc => {
                const user = userDoc.data();
                users.push({ id: userDoc.id, ...user });
            });
            
            // Sort users by creation date (newest first)
            users.sort((a, b) => {
                const aTime = a.createdAt?.seconds || 0;
                const bTime = b.createdAt?.seconds || 0;
                return bTime - aTime;
            });

            users.forEach(user => {
                const isBanned = user.isBanned || false;
                const isGuest = !user.email || user.email === '';
                const joinDate = user.createdAt ? new Date(user.createdAt.seconds * 1000).toLocaleDateString() : 'Unknown';
                const shortId = user.id.substring(0, 8) + '...';
                
                tableHTML += `
                    <tr class="user-row" data-user-id="${user.id}" data-status="${isBanned ? 'banned' : 'active'}" data-type="${isGuest ? 'guest' : 'registered'}">
                        <td title="${user.id}">${shortId}</td>
                        <td>${user.displayName || 'Unknown'}</td>
                        <td>${user.email || '<em>Guest Account</em>'}</td>
                        <td>${user.pronouns || 'Not specified'}</td>
                        <td><span class="account-type-${isGuest ? 'guest' : 'registered'}">${isGuest ? 'Guest' : 'Registered'}</span></td>
                        <td>${joinDate}</td>
                        <td><span class="status-${isBanned ? 'banned' : 'active'}">${isBanned ? 'Banned' : 'Active'}</span></td>
                        <td>
                            <div class="action-buttons">
                                <button class="action-btn view-btn" data-uid="${user.id}" title="View Details">👁️</button>
                                <button class="action-btn ${isBanned ? 'unban-btn' : 'ban-btn'}" data-uid="${user.id}" title="${isBanned ? 'Unban User' : 'Ban User'}">
                                    ${isBanned ? '✅' : '🚫'}
                                </button>
                            </div>
                        </td>
                    </tr>
                `;
            });
        }
        tableHTML += `</tbody></table>`;
        userManagementTable.innerHTML = tableHTML;
        
        // Add search and filter functionality
        setupUserTableControls();
    }

    function setupUserTableControls() {
        const searchInput = document.getElementById('user-search');
        const filterSelect = document.getElementById('user-filter');
        
        if (searchInput) {
            searchInput.addEventListener('input', filterUserTable);
        }
        if (filterSelect) {
            filterSelect.addEventListener('change', filterUserTable);
        }
    }

    function filterUserTable() {
        const searchTerm = document.getElementById('user-search')?.value.toLowerCase() || '';
        const filterValue = document.getElementById('user-filter')?.value || 'all';
        const rows = document.querySelectorAll('.user-row');
        
        rows.forEach(row => {
            const displayName = row.children[1].textContent.toLowerCase();
            const email = row.children[2].textContent.toLowerCase();
            const status = row.dataset.status;
            const type = row.dataset.type;
            
            // Check search term
            const matchesSearch = displayName.includes(searchTerm) || email.includes(searchTerm);
            
            // Check filter
            let matchesFilter = true;
            switch (filterValue) {
                case 'active':
                    matchesFilter = status === 'active';
                    break;
                case 'banned':
                    matchesFilter = status === 'banned';
                    break;
                case 'guest':
                    matchesFilter = type === 'guest';
                    break;
                case 'registered':
                    matchesFilter = type === 'registered';
                    break;
            }
            
            row.style.display = (matchesSearch && matchesFilter) ? '' : 'none';
        });
    }

    async function renderReportsTable(reportsSnapshot) {
        let tableHTML = `
            <div class="table-controls">
                <input type="text" id="report-search" placeholder="Search reports by reason..." class="search-input">
                <select id="report-sort" class="filter-select">
                    <option value="newest">Newest First</option>
                    <option value="oldest">Oldest First</option>
                </select>
            </div>
            <table>
                <thead>
                    <tr>
                        <th>Report ID</th>
                        <th>Reported User</th>
                        <th>Reporter</th>
                        <th>Reason</th>
                        <th>Chat</th>
                        <th>Date</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody id="reports-tbody">`;
        
        if (reportsSnapshot.empty) {
            tableHTML += `<tr><td colspan="7">No active reports.</td></tr>`;
        } else {
            const reports = [];
            reportsSnapshot.forEach(reportDoc => {
                const report = reportDoc.data();
                reports.push({ id: reportDoc.id, ...report });
            });
            
            // Sort reports by timestamp (newest first by default)
            reports.sort((a, b) => {
                const aTime = a.timestamp?.seconds || 0;
                const bTime = b.timestamp?.seconds || 0;
                return bTime - aTime;
            });

            // Get user details for better display
            const userCache = new Map();
            const getUserDetails = async (userId) => {
                if (userCache.has(userId)) {
                    return userCache.get(userId);
                }
                try {
                    const userDoc = await getDoc(doc(db, "users", userId));
                    const userData = userDoc.exists() ? userDoc.data() : { displayName: 'Unknown User' };
                    userCache.set(userId, userData);
                    return userData;
                } catch (error) {
                    console.error(`Error fetching user ${userId}:`, error);
                    return { displayName: 'Error Loading' };
                }
            };

            // Process reports with user details
            for (const report of reports) {
                const reportedUser = await getUserDetails(report.reportedUserId);
                const reporter = await getUserDetails(report.reporterId);
                const shortReportId = report.id.substring(0, 8) + '...';
                const shortChatId = report.chatId ? report.chatId.substring(0, 8) + '...' : 'N/A';
                const timestamp = report.timestamp ? new Date(report.timestamp.seconds * 1000).toLocaleString() : 'N/A';
                
                tableHTML += `
                    <tr class="report-row" data-report-id="${report.id}">
                        <td title="${report.id}">${shortReportId}</td>
                        <td>
                            <div class="user-info">
                                <strong>${reportedUser.displayName}</strong>
                                <small>${report.reportedUserId.substring(0, 8)}...</small>
                            </div>
                        </td>
                        <td>
                            <div class="user-info">
                                <strong>${reporter.displayName}</strong>
                                <small>${report.reporterId.substring(0, 8)}...</small>
                            </div>
                        </td>
                        <td class="reason-cell">${report.reason}</td>
                        <td title="${report.chatId || 'N/A'}">${shortChatId}</td>
                        <td>${timestamp}</td>
                        <td>
                            <div class="action-buttons">
                                <button class="action-btn view-btn" data-report-id="${report.id}" title="View Details">👁️</button>
                                <button class="action-btn ban-btn" data-uid="${report.reportedUserId}" title="Ban Reported User">🚫</button>
                                <button class="action-btn delete-btn" data-report-id="${report.id}" title="Dismiss Report">🗑️</button>
                            </div>
                        </td>
                    </tr>
                `;
            }
        }
        tableHTML += `</tbody></table>`;
        reportedContentTable.innerHTML = tableHTML;
        
        // Add search and sort functionality
        setupReportTableControls();
    }

    function setupReportTableControls() {
        const searchInput = document.getElementById('report-search');
        const sortSelect = document.getElementById('report-sort');
        
        if (searchInput) {
            searchInput.addEventListener('input', filterReportTable);
        }
        if (sortSelect) {
            sortSelect.addEventListener('change', sortReportTable);
        }
    }

    function filterReportTable() {
        const searchTerm = document.getElementById('report-search')?.value.toLowerCase() || '';
        const rows = document.querySelectorAll('.report-row');
        
        rows.forEach(row => {
            const reason = row.querySelector('.reason-cell').textContent.toLowerCase();
            const reportedUser = row.children[1].textContent.toLowerCase();
            const reporter = row.children[2].textContent.toLowerCase();
            
            const matchesSearch = reason.includes(searchTerm) || 
                                reportedUser.includes(searchTerm) || 
                                reporter.includes(searchTerm);
            
            row.style.display = matchesSearch ? '' : 'none';
        });
    }

    function sortReportTable() {
        const sortValue = document.getElementById('report-sort')?.value || 'newest';
        const tbody = document.getElementById('reports-tbody');
        const rows = Array.from(tbody.querySelectorAll('.report-row'));
        
        rows.sort((a, b) => {
            const aDate = new Date(a.children[5].textContent);
            const bDate = new Date(b.children[5].textContent);
            
            if (sortValue === 'oldest') {
                return aDate - bDate;
            } else {
                return bDate - aDate;
            }
        });
        
        rows.forEach(row => tbody.appendChild(row));
    }


    // --- Admin Actions (Event Delegation on the body) ---
    document.body.addEventListener('click', async (e) => {
        const target = e.target;
        const uid = target.dataset.uid;
        const reportId = target.dataset.reportId;

        // View User Details
        if (target.classList.contains('view-btn') && uid) {
            await showUserDetails(uid);
        }

        // View Report Details
        if (target.classList.contains('view-btn') && reportId) {
            await showReportDetails(reportId);
        }

        // Ban User
        if (target.classList.contains('ban-btn') && uid) {
            try {
                const userDoc = await getDoc(doc(db, "users", uid));
                const userData = userDoc.exists() ? userDoc.data() : {};
                const userName = userData.displayName || 'Unknown User';
                
                modal.show({
                    title: 'Confirm Ban',
                    text: `Are you sure you want to ban <strong>${userName}</strong>?<br><br>They will be immediately logged out and unable to sign in until unbanned.`,
                    confirmText: 'Ban User',
                    confirmClass: 'ban-btn',
                    onConfirm: async () => {
                        try {
                            await updateDoc(doc(db, "users", uid), { isBanned: true });
                            showNotification('User banned successfully', 'success');
                            modal.hide();
                        } catch (error) {
                            console.error('Error banning user:', error);
                            showNotification('Error banning user', 'error');
                        }
                    }
                });
            } catch (error) {
                console.error('Error fetching user for ban:', error);
                showNotification('Error loading user data', 'error');
            }
        }
        
        // Unban User
        if (target.classList.contains('unban-btn') && uid) {
            try {
                const userDoc = await getDoc(doc(db, "users", uid));
                const userData = userDoc.exists() ? userDoc.data() : {};
                const userName = userData.displayName || 'Unknown User';
                
                modal.show({
                    title: 'Confirm Unban',
                    text: `Are you sure you want to unban <strong>${userName}</strong>?<br><br>They will be able to sign in again immediately.`,
                    confirmText: 'Unban User',
                    confirmClass: 'unban-btn',
                    onConfirm: async () => {
                        try {
                            await updateDoc(doc(db, "users", uid), { isBanned: false });
                            showNotification('User unbanned successfully', 'success');
                            modal.hide();
                        } catch (error) {
                            console.error('Error unbanning user:', error);
                            showNotification('Error unbanning user', 'error');
                        }
                    }
                });
            } catch (error) {
                console.error('Error fetching user for unban:', error);
                showNotification('Error loading user data', 'error');
            }
        }

        // Dismiss Report
        if (target.classList.contains('delete-btn') && reportId) {
            modal.show({
                title: 'Confirm Dismissal',
                text: `Are you sure you want to dismiss this report?<br><br>This action cannot be undone.`,
                confirmText: 'Dismiss Report',
                confirmClass: 'delete-btn',
                onConfirm: async () => {
                    try {
                        await deleteDoc(doc(db, "reports", reportId));
                        showNotification('Report dismissed successfully', 'success');
                        modal.hide();
                    } catch (error) {
                        console.error('Error dismissing report:', error);
                        showNotification('Error dismissing report', 'error');
                    }
                }
            });
        }
    });

    // --- User Details Modal ---
    async function showUserDetails(uid) {
        try {
            const userDoc = await getDoc(doc(db, "users", uid));
            if (!userDoc.exists()) {
                showNotification('User not found', 'error');
                return;
            }

            const userData = userDoc.data();
            const joinDate = userData.createdAt ? new Date(userData.createdAt.seconds * 1000).toLocaleString() : 'Unknown';
            const isGuest = !userData.email || userData.email === '';
            const isBanned = userData.isBanned || false;

            modal.show({
                title: 'User Details',
                text: `
                    <div class="user-details">
                        <div class="detail-row">
                            <strong>Display Name:</strong> ${userData.displayName || 'Unknown'}
                        </div>
                        <div class="detail-row">
                            <strong>Email:</strong> ${userData.email || 'Guest Account'}
                        </div>
                        <div class="detail-row">
                            <strong>Pronouns:</strong> ${userData.pronouns || 'Not specified'}
                        </div>
                        <div class="detail-row">
                            <strong>Account Type:</strong> ${isGuest ? 'Guest' : 'Registered'}
                        </div>
                        <div class="detail-row">
                            <strong>Status:</strong> <span class="status-${isBanned ? 'banned' : 'active'}">${isBanned ? 'Banned' : 'Active'}</span>
                        </div>
                        <div class="detail-row">
                            <strong>User ID:</strong> <code>${uid}</code>
                        </div>
                        <div class="detail-row">
                            <strong>Joined:</strong> ${joinDate}
                        </div>
                    </div>
                `,
                confirmText: 'Close',
                confirmClass: 'modal-btn-cancel',
                onConfirm: () => modal.hide()
            });
        } catch (error) {
            console.error('Error loading user details:', error);
            showNotification('Error loading user details', 'error');
        }
    }

    // --- Report Details Modal ---
    async function showReportDetails(reportId) {
        try {
            const reportDoc = await getDoc(doc(db, "reports", reportId));
            if (!reportDoc.exists()) {
                showNotification('Report not found', 'error');
                return;
            }

            const reportData = reportDoc.data();
            const timestamp = reportData.timestamp ? new Date(reportData.timestamp.seconds * 1000).toLocaleString() : 'Unknown';
            
            // Get user details
            const [reportedUserDoc, reporterDoc] = await Promise.all([
                getDoc(doc(db, "users", reportData.reportedUserId)),
                getDoc(doc(db, "users", reportData.reporterId))
            ]);

            const reportedUser = reportedUserDoc.exists() ? reportedUserDoc.data() : { displayName: 'Unknown User' };
            const reporter = reporterDoc.exists() ? reporterDoc.data() : { displayName: 'Unknown User' };

            modal.show({
                title: 'Report Details',
                text: `
                    <div class="report-details">
                        <div class="detail-row">
                            <strong>Report ID:</strong> <code>${reportId}</code>
                        </div>
                        <div class="detail-row">
                            <strong>Reported User:</strong> ${reportedUser.displayName}
                        </div>
                        <div class="detail-row">
                            <strong>Reporter:</strong> ${reporter.displayName}
                        </div>
                        <div class="detail-row">
                            <strong>Reason:</strong> ${reportData.reason}
                        </div>
                        <div class="detail-row">
                            <strong>Chat ID:</strong> <code>${reportData.chatId || 'N/A'}</code>
                        </div>
                        <div class="detail-row">
                            <strong>Reported:</strong> ${timestamp}
                        </div>
                    </div>
                `,
                confirmText: 'Close',
                confirmClass: 'modal-btn-cancel',
                onConfirm: () => modal.hide()
            });
        } catch (error) {
            console.error('Error loading report details:', error);
            showNotification('Error loading report details', 'error');
        }
    }

    // --- Notification System ---
    function showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.textContent = message;
        
        document.body.appendChild(notification);
        
        // Trigger animation
        setTimeout(() => notification.classList.add('show'), 100);
        
        // Remove after 3 seconds
        setTimeout(() => {
            notification.classList.remove('show');
            setTimeout(() => document.body.removeChild(notification), 300);
        }, 3000);
    }

    // Clean up listeners when logging out
    function cleanup() {
        activeListeners.forEach(unsubscribe => unsubscribe());
        activeListeners = [];
    }
});