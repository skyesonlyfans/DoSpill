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
    getCountFromServer
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
            this.text.textContent = text;
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
            // Call the new serverless function to check credentials
            const response = await fetch('/api/admin-login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username: user, password: pass })
            });

            const data = await response.json();

            if (response.ok && data.success) {
                sessionStorage.setItem('adminAuthenticated', 'true');
                showAdminPanel();
            } else {
                loginError.textContent = data.message || 'Invalid username or password.';
            }
        } catch (error) {
            console.error('Admin login error:', error);
            loginError.textContent = 'An error occurred. Please try again.';
        }
    });

    logoutBtn.addEventListener('click', () => {
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
    function loadAdminData() {
        // Load stats with real-time listeners
        const usersCol = collection(db, "users");
        onSnapshot(usersCol, (snapshot) => totalUsersStat.textContent = snapshot.size);
        
        const chatsCol = collection(db, "chats");
        onSnapshot(chatsCol, (snapshot) => totalGroupsStat.textContent = snapshot.size);

        const reportsCol = collection(db, "reports");
        onSnapshot(reportsCol, (snapshot) => {
            reportedUsersStat.textContent = snapshot.size;
            renderReportsTable(snapshot);
        });

        // Load Users table
        onSnapshot(query(usersCol), (snapshot) => renderUserTable(snapshot));
    }

    function renderUserTable(usersSnapshot) {
        let tableHTML = `
            <table>
                <thead>
                    <tr>
                        <th>User ID</th>
                        <th>Email</th>
                        <th>Display Name</th>
                        <th>Status</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>`;
        if (usersSnapshot.empty) {
            tableHTML += `<tr><td colspan="5">No users found.</td></tr>`;
        } else {
            usersSnapshot.forEach(userDoc => {
                const user = userDoc.data();
                const isBanned = user.isBanned || false;
                tableHTML += `
                    <tr>
                        <td>${userDoc.id}</td>
                        <td>${user.email || 'N/A (Guest)'}</td>
                        <td>${user.displayName}</td>
                        <td><span class="status-${isBanned ? 'banned' : 'active'}">${isBanned ? 'Banned' : 'Active'}</span></td>
                        <td>
                            <button class="action-btn ${isBanned ? 'unban-btn' : 'ban-btn'}" data-uid="${userDoc.id}">
                                ${isBanned ? 'Unban' : 'Ban'}
                            </button>
                        </td>
                    </tr>
                `;
            });
        }
        tableHTML += `</tbody></table>`;
        userManagementTable.innerHTML = tableHTML;
    }

    function renderReportsTable(reportsSnapshot) {
        let tableHTML = `
            <table>
                <thead>
                    <tr>
                        <th>Reported User ID</th>
                        <th>Reporter ID</th>
                        <th>Reason</th>
                        <th>Timestamp</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>`;
        if (reportsSnapshot.empty) {
            tableHTML += `<tr><td colspan="5">No active reports.</td></tr>`;
        } else {
            reportsSnapshot.forEach(reportDoc => {
                const report = reportDoc.data();
                tableHTML += `
                    <tr>
                        <td>${report.reportedUserId}</td>
                        <td>${report.reporterId}</td>
                        <td>${report.reason}</td>
                        <td>${report.timestamp ? new Date(report.timestamp.seconds * 1000).toLocaleString() : 'N/A'}</td>
                        <td>
                            <button class="action-btn delete-btn" data-report-id="${reportDoc.id}">Dismiss</button>
                            <button class="action-btn ban-btn" data-uid="${report.reportedUserId}">Ban User</button>
                        </td>
                    </tr>
                `;
            });
        }
        tableHTML += `</tbody></table>`;
        reportedContentTable.innerHTML = tableHTML;
    }


    // --- Admin Actions (Event Delegation on the body) ---
    document.body.addEventListener('click', async (e) => {
        const target = e.target;
        const uid = target.dataset.uid;
        const reportId = target.dataset.reportId;

        // Ban User
        if (target.classList.contains('ban-btn') && uid) {
            modal.show({
                title: 'Confirm Ban',
                text: `Are you sure you want to ban user ${uid}? They will be logged out and unable to sign in.`,
                confirmText: 'Ban User',
                confirmClass: 'ban-btn',
                onConfirm: async () => {
                    await updateDoc(doc(db, "users", uid), { isBanned: true });
                    modal.hide();
                }
            });
        }
        
        // Unban User
        if (target.classList.contains('unban-btn') && uid) {
            modal.show({
                title: 'Confirm Unban',
                text: `Are you sure you want to unban user ${uid}? They will be able to sign in again.`,
                confirmText: 'Unban User',
                confirmClass: 'unban-btn',
                onConfirm: async () => {
                    await updateDoc(doc(db, "users", uid), { isBanned: false });
                    modal.hide();
                }
            });
        }

        // Dismiss Report
        if (target.classList.contains('delete-btn') && reportId) {
            modal.show({
                title: 'Confirm Dismissal',
                text: `Are you sure you want to dismiss report ${reportId}? This cannot be undone.`,
                confirmText: 'Dismiss Report',
                confirmClass: 'delete-btn',
                onConfirm: async () => {
                    await deleteDoc(doc(db, "reports", reportId));
                    modal.hide();
                }
            });
        }
    });
});
