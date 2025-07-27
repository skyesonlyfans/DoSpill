// admin/admin.js
import {
    getAuth,
    signInWithEmailAndPassword,
    signOut
} from "https://www.gstatic.com/firebasejs/9.6.1/firebase-auth.js";
import {
    getFirestore,
    collection,
    getDocs,
    doc,
    updateDoc,
    deleteDoc,
    query,
    where,
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

    // --- Authentication Logic ---
    loginForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const user = document.getElementById('admin-user').value;
        const pass = document.getElementById('admin-pass').value;

        // Hardcoded credentials as per instructions
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

    // Check session storage on page load
    if (sessionStorage.getItem('adminAuthenticated') === 'true') {
        showAdminPanel();
    } else {
        showLogin();
    }


    // --- Data Loading and Rendering ---
    async function loadAdminData() {
        // Load stats
        const usersSnapshot = await getDocs(collection(db, "users"));
        totalUsersStat.textContent = usersSnapshot.size;

        // In a real app, message counting would be more complex, likely using Cloud Functions
        totalMessagesStat.textContent = 'N/A'; // Placeholder

        // Load Users
        renderUserTable(usersSnapshot);

        // Load Reports (Assuming a 'reports' collection exists)
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
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
        `;
        usersSnapshot.forEach(userDoc => {
            const user = userDoc.data();
            tableHTML += `
                <tr>
                    <td>${userDoc.id}</td>
                    <td>${user.email}</td>
                    <td>${user.username}</td>
                    <td>
                        <button class="action-btn ban-btn" data-uid="${userDoc.id}">Ban</button>
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
                    <td>${new Date(report.timestamp.seconds * 1000).toLocaleString()}</td>
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

        // Ban User
        if (target.classList.contains('ban-btn') && target.dataset.uid) {
            const uid = target.dataset.uid;
            if (confirm(`Are you sure you want to ban user ${uid}? This is a placeholder action.`)) {
                // In a real app, this would set a flag in the user's document
                // For example: await updateDoc(doc(db, "users", uid), { isBanned: true });
                console.log(`Banning user ${uid}`);
                alert(`User ${uid} has been "banned". (Simulated)`);
            }
        }

        // Dismiss Report
        if (target.classList.contains('delete-btn') && target.dataset.reportId) {
            const reportId = target.dataset.reportId;
            if (confirm(`Are you sure you want to dismiss report ${reportId}?`)) {
                await deleteDoc(doc(db, "reports", reportId));
                console.log(`Report ${reportId} dismissed.`);
                alert(`Report ${reportId} dismissed.`);
            }
        }
    });

});
