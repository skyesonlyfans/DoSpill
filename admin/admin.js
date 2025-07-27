// admin/admin.js

/*
NOTE FOR MODAL FUNCTIONALITY:
The following HTML should be added inside the <body> of `admin/index.html` for the custom modals to work.
<div id="modal-backdrop" class="modal-backdrop" style="display: none;">
    <div id="modal-box" class="modal-box">
        <p id="modal-text"></p>
        <div id="modal-buttons" class="modal-buttons">
            <button id="modal-confirm-btn" class="action-btn"></button>
            <button id="modal-cancel-btn" class="action-btn">Cancel</button>
        </div>
    </div>
</div>

And the following CSS should be added to `admin/style.css`:
.modal-backdrop {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background-color: rgba(0, 0, 0, 0.6);
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 1000;
}
.modal-box {
    background: #2c2c2e;
    color: #ffffff;
    padding: 24px;
    border-radius: 12px;
    box-shadow: 0 5px 15px rgba(0,0,0,0.3);
    text-align: center;
    max-width: 400px;
    width: 90%;
}
.modal-box p {
    margin-bottom: 20px;
    font-size: 16px;
}
.modal-buttons {
    display: flex;
    justify-content: center;
    gap: 12px;
}
.modal-buttons button {
    padding: 10px 20px;
    border-radius: 8px;
    border: none;
    cursor: pointer;
    font-weight: 600;
}
#modal-confirm-btn {
    background-color: #ff3b30; /* Default to destructive action color */
    color: white;
}
#modal-cancel-btn {
    background-color: #555;
    color: white;
}
*/

import {
    getFirestore,
    collection,
    getDocs,
    doc,
    updateDoc,
    deleteDoc,
    query,
    onSnapshot
} from "https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js";

document.addEventListener('DOMContentLoaded', () => {
    const db = getFirestore();

    // DOM Elements
    const loginContainer = document.getElementById('login-container');
    const adminPanel = document.getElementById('admin-panel');
    const loginForm = document.getElementById('admin-login-form');
    const loginError = document.getElementById('login-error');
    const logoutBtn = document.getElementById('admin-logout-btn');

    // Stats Elements
    const totalUsersStat = document.getElementById('total-users-stat');
    const totalMessagesStat = document.getElementById('total-messages-stat');
    const reportedUsersStat = document.getElementById('reported-users-stat');

    // Table Containers
    const userManagementTableContainer = document.getElementById('user-management-table');
    const reportedContentTableContainer = document.getElementById('reported-content-table');
    
    // Modal Elements
    const modalBackdrop = document.getElementById('modal-backdrop');
    const modalText = document.getElementById('modal-text');
    const modalConfirmBtn = document.getElementById('modal-confirm-btn');
    const modalCancelBtn = document.getElementById('modal-cancel-btn');

    // --- Modal Logic ---
    let onConfirmCallback = null;

    function showModal(text, confirmText, confirmClass, onConfirm) {
        modalText.textContent = text;
        modalConfirmBtn.textContent = confirmText;
        modalConfirmBtn.className = `action-btn ${confirmClass}`;
        onConfirmCallback = onConfirm;
        modalBackdrop.style.display = 'flex';
    }
    
    function showAlert(text) {
        showModal(text, 'OK', '', () => closeModal());
        modalCancelBtn.style.display = 'none';
    }

    function closeModal() {
        modalBackdrop.style.display = 'none';
        onConfirmCallback = null;
        modalCancelBtn.style.display = 'inline-block'; // Reset cancel button
    }

    modalConfirmBtn.addEventListener('click', () => {
        if (onConfirmCallback) {
            onConfirmCallback();
        }
        closeModal();
    });

    modalCancelBtn.addEventListener('click', closeModal);


    // --- Authentication Logic ---
    loginForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const user = document.getElementById('admin-user').value;
        const pass = document.getElementById('admin-pass').value;

        if (user === 'oxyisbad' && pass === 'Bas3sec639') {
            sessionStorage.setItem('adminAuthenticated', 'true');
            showAdminPanel();
        } else {
            loginError.textContent = 'Invalid username or password.';
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

    if (sessionStorage.getItem('adminAuthenticated') === 'true') {
        showAdminPanel();
    } else {
        showLogin();
    }


    // --- Data Loading and Rendering ---
    function loadAdminData() {
        // Use onSnapshot for real-time updates on users
        const usersQuery = query(collection(db, "users"));
        onSnapshot(usersQuery, (snapshot) => {
            totalUsersStat.textContent = snapshot.size;
            renderUserTable(snapshot);
        });

        totalMessagesStat.textContent = 'N/A'; // Placeholder

        const reportsQuery = query(collection(db, "reports"));
        onSnapshot(reportsQuery, (snapshot) => {
            reportedUsersStat.textContent = snapshot.size;
            renderReportsTable(snapshot);
        });
    }

    function renderUserTable(usersSnapshot) {
        let tableHTML = `
            <table>
                <thead>
                    <tr>
                        <th>User ID</th>
                        <th>Email</th>
                        <th>Username</th>
                        <th>Status</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
        `;
        usersSnapshot.forEach(userDoc => {
            const user = userDoc.data();
            const isBanned = user.isBanned || false;
            tableHTML += `
                <tr>
                    <td>${userDoc.id}</td>
                    <td>${user.email}</td>
                    <td>${user.username}</td>
                    <td><span class="status-${isBanned ? 'banned' : 'active'}">${isBanned ? 'Banned' : 'Active'}</span></td>
                    <td>
                        <button class="action-btn ${isBanned ? 'unban-btn' : 'ban-btn'}" data-uid="${userDoc.id}">
                            ${isBanned ? 'Unban' : 'Ban'}
                        </button>
                    </td>
                </tr>
            `;
        });
        tableHTML += `</tbody></table>`;
        userManagementTableContainer.innerHTML = tableHTML;
    }

    function renderReportsTable(reportsSnapshot) {
        if (reportsSnapshot.empty) {
            reportedContentTableContainer.innerHTML = `<p>No active reports.</p>`;
            return;
        }

        let tableHTML = `
            <table>
                <thead>
                    <tr>
                        <th>Reported User</th>
                        <th>Reporter</th>
                        <th>Reason</th>
                        <th>Timestamp</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
        `;
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
        tableHTML += `</tbody></table>`;
        reportedContentTableContainer.innerHTML = tableHTML;
    }


    // --- Admin Actions (Event Delegation) ---
    document.body.addEventListener('click', async (e) => {
        const target = e.target;
        const uid = target.dataset.uid;
        const reportId = target.dataset.reportId;

        // Ban User
        if (target.classList.contains('ban-btn') && uid) {
            showModal(`Are you sure you want to ban user ${uid}?`, 'Ban User', 'ban-btn', async () => {
                const userRef = doc(db, "users", uid);
                await updateDoc(userRef, { isBanned: true });
                showAlert(`User ${uid} has been banned.`);
            });
        }
        
        // Unban User
        if (target.classList.contains('unban-btn') && uid) {
            showModal(`Are you sure you want to unban user ${uid}?`, 'Unban User', 'unban-btn', async () => {
                const userRef = doc(db, "users", uid);
                await updateDoc(userRef, { isBanned: false });
                showAlert(`User ${uid} has been unbanned.`);
            });
        }

        // Dismiss Report
        if (target.classList.contains('delete-btn') && reportId) {
            showModal(`Are you sure you want to dismiss report ${reportId}?`, 'Dismiss', 'delete-btn', async () => {
                await deleteDoc(doc(db, "reports", reportId));
                showAlert(`Report ${reportId} dismissed.`);
            });
        }
    });
});
