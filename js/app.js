// js/app.js

import {
    getAuth,
    onAuthStateChanged,
    GoogleAuthProvider,
    signInWithPopup,
    signInAnonymously,
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    signOut,
    updateProfile
} from "https://www.gstatic.com/firebasejs/9.17.1/firebase-auth.js";
import {
    getFirestore,
    collection,
    addDoc,
    query,
    where,
    onSnapshot,
    serverTimestamp,
    doc,
    setDoc,
    getDoc,
    updateDoc,
    orderBy,
    arrayUnion,
    getDocs
} from "https://www.gstatic.com/firebasejs/9.17.1/firebase-firestore.js";

document.addEventListener('DOMContentLoaded', () => {
    // --- Firebase Services & App State ---
    const auth = getAuth();
    const db = getFirestore();
    const root = document.getElementById('root');
    let currentUser = null;
    let currentUserProfile = null;
    let currentChatId = null;
    let currentChatInfo = null;
    // A map to store unsubscribe functions for listeners to prevent duplicates
    let activeListeners = new Map();

    // --- Modal Control (Robust and Centralized) ---
    const modal = {
        backdrop: document.getElementById('modal-backdrop'),
        box: document.getElementById('modal-box'),
        title: document.getElementById('modal-title'),
        text: document.getElementById('modal-text'),
        inputContainer: document.getElementById('modal-input-container'),
        input: document.getElementById('modal-input'),
        confirmBtn: document.getElementById('modal-confirm-btn'),
        cancelBtn: document.getElementById('modal-cancel-btn'),
        _onConfirm: null,
        _onCancel: null,

        show: function({ title, text, input, confirmText = 'Confirm', cancelText = 'Cancel', onConfirm, onCancel }) {
            this.title.textContent = title;
            this.text.innerHTML = text; // Use innerHTML to allow for simple formatting if needed
            this.confirmBtn.textContent = confirmText;
            this.cancelBtn.textContent = cancelText;
            
            this.inputContainer.style.display = input ? 'block' : 'none';
            if (input) {
                this.input.placeholder = input.placeholder || '';
                this.input.type = input.type || 'text';
                this.input.value = input.value || '';
            }
            
            this._onConfirm = onConfirm;
            this._onCancel = onCancel;
            
            this.cancelBtn.style.display = onCancel || cancelText ? 'inline-block' : 'none';
            
            this.backdrop.style.display = 'flex';
        },
        hide: function() {
            this.backdrop.style.display = 'none';
            this._onConfirm = null;
            this._onCancel = null;
        }
    };
    modal.confirmBtn.addEventListener('click', () => {
        if (modal._onConfirm) {
            modal._onConfirm(modal.input.value);
        }
    });
    modal.cancelBtn.addEventListener('click', () => {
        if (modal._onCancel) {
            modal._onCancel();
        }
        modal.hide(); // Always hide on cancel
    });

    // --- Main Auth Observer ---
    onAuthStateChanged(auth, async (user) => {
        detachAllListeners();
        if (user) {
            const userRef = doc(db, "users", user.uid);
            const userDoc = await getDoc(userRef);

            if (!userDoc.exists()) {
                const profile = {
                    uid: user.uid,
                    email: user.email,
                    displayName: user.displayName || (user.isAnonymous ? `Guest-${user.uid.substring(0, 6)}` : 'New User'),
                    profilePicture: user.photoURL || `https://placehold.co/100x100/5856d6/FFFFFF?text=${(user.displayName || 'G').charAt(0)}`,
                    createdAt: serverTimestamp(),
                    pronouns: 'Prefer not to say',
                    isBanned: false
                };
                await setDoc(userRef, profile);
                currentUserProfile = profile;
                currentUser = user;
                renderProfileSetup();
            } else {
                currentUserProfile = userDoc.data();
                if (currentUserProfile.isBanned) {
                    root.innerHTML = `<div class="auth-page"><h1 class="auth-logo">Do<span>Spill</span></h1><p style="color: var(--error-red);">Your account has been banned by an administrator.</p></div>`;
                    await signOut(auth);
                } else {
                    currentUser = user;
                    renderApp();
                }
            }
        } else {
            currentUser = null;
            currentUserProfile = null;
            renderAuthPage();
        }
    });

    // --- Render Functions ---

    function renderAuthPage() {
        root.innerHTML = `
            <div class="auth-page">
                <h1 class="auth-logo">Do<span>Spill</span></h1>
                <p>Connect instantly. Spill freely.</p>
                <div class="auth-options">
                    <button class="auth-btn google-btn" id="google-signin">
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 48 48"><path fill="#FFC107" d="M43.611,20.083H42V20H24v8h11.303c-1.649,4.657-6.08,8-11.303,8c-6.627,0-12-5.373-12-12c0-6.627,5.373-12,12-12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C12.955,4,4,12.955,4,24c0,11.045,8.955,20,20,20c11.045,0,20-8.955,20-20C44,22.659,43.862,21.35,43.611,20.083z"></path><path fill="#FF3D00" d="M6.306,14.691l6.571,4.819C14.655,15.108,18.961,12,24,12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C16.318,4,9.656,8.337,6.306,14.691z"></path><path fill="#4CAF50" d="M24,44c5.166,0,9.86-1.977,13.409-5.192l-6.19-5.238C29.211,35.091,26.715,36,24,36c-5.202,0-9.619-3.317-11.283-7.946l-6.522,5.025C9.505,39.556,16.227,44,24,44z"></path><path fill="#1976D2" d="M43.611,20.083H42V20H24v8h11.303c-0.792,2.237-2.231,4.166-4.087,5.574l6.19,5.238C39.99,36.62,44,31.1,44,24C44,22.659,43.862,21.35,43.611,20.083z"></path></svg>
                        Continue with Google
                    </button>
                    <button class="auth-btn email-btn" id="email-signin">Continue with Email</button>
                    <button class="auth-btn guest-btn" id="guest-signin">Continue as Guest</button>
                </div>
            </div>
        `;
        addAuthPageEventListeners();
    }
    
    function renderProfileSetup() {
        modal.show({
            title: 'Welcome to DoSpill!',
            text: 'Let\'s set up your display name. You can change this later.',
            input: { placeholder: currentUserProfile.displayName || 'Enter your name' },
            confirmText: 'Save & Continue',
            onConfirm: async (newName) => {
                const name = newName.trim();
                if (name) {
                    await updateDoc(doc(db, "users", currentUser.uid), { displayName: name });
                    currentUserProfile.displayName = name;
                    modal.hide();
                    renderApp();
                } else {
                    renderProfileSetup();
                }
            }
        });
    }

    function renderApp() {
        detachAllListeners();
        root.innerHTML = `
            <div class="app-container">
                <header class="app-header">
                    <h1>Chats</h1>
                    <button class="header-btn" id="profile-btn">Profile</button>
                </header>
                <main class="chat-list">
                    <div class="chat-list-actions">
                        <button class="action-btn" id="create-group-btn">New Group</button>
                        <button class="action-btn" id="join-group-btn">Join Group</button>
                    </div>
                    <div id="chats-container"></div>
                </main>
            </div>
        `;
        addAppEventListeners();
        renderChatList();
    }

    function renderProfilePage() {
        detachAllListeners();
        
        // Ensure we have user profile data
        if (!currentUserProfile || !currentUser) {
            renderApp();
            return;
        }
        
        root.innerHTML = `
            <div class="profile-page">
                <header class="profile-header">
                    <button class="back-button" id="back-to-chats">&lt;</button>
                    <h1>Profile</h1>
                    <div></div>
                </header>
                <main class="profile-content">
                    <div class="profile-avatar">
                        <img src="${currentUserProfile.profilePicture || 'https://placehold.co/120x120/5856d6/FFFFFF?text=' + (currentUserProfile.displayName?.charAt(0) || 'U')}" alt="Profile Picture" class="profile-picture">
                        <h2>${currentUserProfile.displayName || 'Unknown User'}</h2>
                        <p class="profile-email">${currentUserProfile.email || 'No email'}</p>
                    </div>
                    <div class="profile-details">
                        <div class="profile-field">
                            <label>Display Name</label>
                            <div class="profile-field-content">
                                <span id="display-name-text">${currentUserProfile.displayName}</span>
                                <button class="edit-btn" id="edit-name-btn">Edit</button>
                            </div>
                        </div>
                        <div class="profile-field">
                            <label>Pronouns</label>
                            <div class="profile-field-content">
                                <span id="pronouns-text">${currentUserProfile.pronouns || 'Prefer not to say'}</span>
                                <button class="edit-btn" id="edit-pronouns-btn">Edit</button>
                            </div>
                        </div>
                        <div class="profile-field">
                            <label>Email</label>
                            <div class="profile-field-content">
                                <span>${currentUserProfile.email || 'No email'}</span>
                                <span class="field-note">Cannot be changed</span>
                            </div>
                        </div>
                        <div class="profile-field">
                            <label>Account Type</label>
                            <div class="profile-field-content">
                                <span>${currentUser.isAnonymous ? 'Guest Account' : 'Registered Account'}</span>
                                <span class="field-note">${currentUser.isAnonymous ? 'Sign up to save your data' : 'Verified account'}</span>
                            </div>
                        </div>
                        <div class="profile-field">
                            <label>Member Since</label>
                            <div class="profile-field-content">
                                <span>${currentUserProfile.createdAt ? new Date(currentUserProfile.createdAt.seconds * 1000).toLocaleDateString() : 'Unknown'}</span>
                                <span class="field-note">Join date</span>
                            </div>
                        </div>
                    </div>
                    <div class="profile-actions">
                        <button class="action-btn danger-btn" id="logout-btn">Sign Out</button>
                        ${currentUser.isAnonymous ? '<button class="action-btn primary-btn" id="upgrade-account-btn">Upgrade to Full Account</button>' : ''}
                    </div>
                </main>
            </div>
        `;
        addProfilePageEventListeners();
    }
    
    function renderChatWindow(chatId, chatData) {
        detachAllListeners();
        currentChatId = chatId;
        currentChatInfo = chatData; // Store chat info for later use
        const memberCount = chatData.participants ? chatData.participants.length : 0;
        root.innerHTML = `
            <div class="chat-window">
                <header class="chat-header">
                    <button class="back-button" id="back-to-chats">&lt;</button>
                    <div class="chat-header-info">
                        <h2>${chatData.name}</h2>
                        <p>${memberCount} Members</p>
                    </div>
                    <button id="chat-options-btn" class="header-btn" style="font-size: 24px;">&#9881;</button>
                </header>
                <div class="message-area" id="message-area">
                    <div class="messages-container" id="messages-container"></div>
                </div>
                <footer class="message-input-area">
                    <input type="file" id="media-input" style="display: none;" accept="image/*">
                    <button id="add-media-btn">+</button>
                    <input type="text" class="message-input" id="message-input" placeholder="Message in ${chatData.name}..." autocomplete="off">
                    <button id="send-btn">→</button>
                </footer>
            </div>
        `;
        addChatWindowEventListeners();
        renderMessages(chatId);
    }

    // --- Event Listener Setup ---

    function addAuthPageEventListeners() {
        document.getElementById('google-signin').addEventListener('click', handleGoogleSignIn);
        document.getElementById('email-signin').addEventListener('click', handleEmailSignIn);
        document.getElementById('guest-signin').addEventListener('click', handleGuestSignIn);
    }
    
    function addAppEventListeners() {
        document.getElementById('profile-btn').addEventListener('click', renderProfilePage);
        document.getElementById('create-group-btn').addEventListener('click', handleCreateGroup);
        document.getElementById('join-group-btn').addEventListener('click', handleJoinGroup);
    }

    function addProfilePageEventListeners() {
        document.getElementById('back-to-chats').addEventListener('click', renderApp);
        document.getElementById('logout-btn').addEventListener('click', () => signOut(auth));
        document.getElementById('edit-name-btn').addEventListener('click', handleEditDisplayName);
        document.getElementById('edit-pronouns-btn').addEventListener('click', handleEditPronouns);
        
        const upgradeBtn = document.getElementById('upgrade-account-btn');
        if (upgradeBtn) {
            upgradeBtn.addEventListener('click', handleUpgradeAccount);
        }
    }
    
    function addChatWindowEventListeners() {
        document.getElementById('back-to-chats').addEventListener('click', renderApp);
        document.getElementById('send-btn').addEventListener('click', handleSendTextMessage);
        document.getElementById('message-input').addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSendTextMessage();
            }
        });
        document.getElementById('add-media-btn').addEventListener('click', () => {
            document.getElementById('media-input').click();
        });
        document.getElementById('media-input').addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) handleFileUpload(file);
        });
        // Listener for the new chat options button
        document.getElementById('chat-options-btn').addEventListener('click', handleChatOptions);
    }

    // --- Auth Handlers ---
    
    async function handleGoogleSignIn() {
        try {
            await signInWithPopup(auth, new GoogleAuthProvider());
        } catch (error) {
            console.error("Google Sign-In Error", error);
            modal.show({ title: 'Sign-In Error', text: `Could not sign in with Google. (${error.code})`, confirmText: 'OK', onConfirm: modal.hide });
        }
    }
    
    async function handleGuestSignIn() {
        try {
            await signInAnonymously(auth);
        } catch (error) {
            console.error("Guest Sign-In Error", error);
            modal.show({ title: 'Sign-In Error', text: `Could not sign in as a guest. (${error.code})`, confirmText: 'OK', onConfirm: modal.hide });
        }
    }
    
    function handleEmailSignIn() {
        modal.show({
            title: 'Continue with Email',
            text: 'Enter your email address to sign in or create an account.',
            input: { placeholder: 'your@email.com', type: 'email' },
            confirmText: 'Next',
            onConfirm: (email) => {
                if (!email) return;
                modal.show({
                    title: 'Enter Password',
                    text: `For email: ${email}`,
                    input: { placeholder: 'Password', type: 'password' },
                    confirmText: 'Sign In',
                    onConfirm: async (password) => {
                        if (!password) return;
                        try {
                            await signInWithEmailAndPassword(auth, email, password);
                            modal.hide();
                        } catch (error) {
                            if (error.code === 'auth/user-not-found') {
                                modal.show({
                                    title: 'Create Account?',
                                    text: `No account found for ${email}. Would you like to create a new one with this password?`,
                                    confirmText: 'Yes, Sign Up',
                                    onConfirm: async () => {
                                        try {
                                            await createUserWithEmailAndPassword(auth, email, password);
                                            modal.hide();
                                        } catch (e) {
                                            modal.show({ title: 'Signup Error', text: e.message, confirmText: 'OK', onConfirm: modal.hide });
                                        }
                                    },
                                    onCancel: () => handleEmailSignIn()
                                });
                            } else {
                                modal.show({ title: 'Sign-In Error', text: error.message, confirmText: 'OK', onConfirm: modal.hide });
                            }
                        }
                    }
                });
            }
        });
    }

    // --- Profile Handlers ---
    
    function handleEditDisplayName() {
        modal.show({
            title: 'Edit Display Name',
            text: 'Enter your new display name.',
            input: { placeholder: currentUserProfile.displayName, value: currentUserProfile.displayName },
            confirmText: 'Save',
            onConfirm: async (newName) => {
                const name = newName.trim();
                if (name && name !== currentUserProfile.displayName) {
                    try {
                        await updateDoc(doc(db, "users", currentUser.uid), { displayName: name });
                        currentUserProfile.displayName = name;
                        
                        // Update the display in the UI
                        document.getElementById('display-name-text').textContent = name;
                        document.querySelector('.profile-avatar h2').textContent = name;
                        
                        modal.hide();
                    } catch (error) {
                        console.error("Failed to update display name:", error);
                        modal.show({ title: 'Error', text: 'Could not update display name. Please try again.', confirmText: 'OK', onConfirm: modal.hide });
                    }
                } else if (!name) {
                    modal.show({ title: 'Invalid Name', text: 'Display name cannot be empty.', confirmText: 'OK', onConfirm: () => handleEditDisplayName() });
                } else {
                    modal.hide();
                }
            },
            cancelText: 'Cancel'
        });
    }

    function handleEditPronouns() {
        const pronounOptions = [
            'He/Him',
            'She/Her', 
            'They/Them',
            'He/They',
            'She/They',
            'Any pronouns',
            'Prefer not to say'
        ];
        
        let optionsHTML = 'Select your pronouns:<br><br>';
        pronounOptions.forEach(pronoun => {
            const isSelected = pronoun === currentUserProfile.pronouns ? ' selected' : '';
            optionsHTML += `<button class="modal-btn${isSelected}" data-pronoun="${pronoun}">${pronoun}</button><br>`;
        });
        
        modal.show({
            title: 'Edit Pronouns',
            text: optionsHTML,
            confirmText: 'Custom',
            onConfirm: () => {
                modal.show({
                    title: 'Custom Pronouns',
                    text: 'Enter your custom pronouns.',
                    input: { placeholder: 'e.g., Ze/Zir' },
                    confirmText: 'Save',
                    onConfirm: async (customPronouns) => {
                        if (customPronouns.trim()) {
                            await updatePronouns(customPronouns.trim());
                        }
                    },
                    cancelText: 'Cancel'
                });
            },
            cancelText: 'Cancel'
        });
        
        // Add event listeners to pronoun buttons
        document.querySelectorAll('[data-pronoun]').forEach(button => {
            button.addEventListener('click', async (e) => {
                const selectedPronoun = e.target.dataset.pronoun;
                await updatePronouns(selectedPronoun);
            });
        });
    }

    async function updatePronouns(pronouns) {
        try {
            await updateDoc(doc(db, "users", currentUser.uid), { pronouns: pronouns });
            currentUserProfile.pronouns = pronouns;
            
            // Update the display in the UI
            document.getElementById('pronouns-text').textContent = pronouns;
            
            modal.hide();
        } catch (error) {
            console.error("Failed to update pronouns:", error);
            modal.show({ title: 'Error', text: 'Could not update pronouns. Please try again.', confirmText: 'OK', onConfirm: modal.hide });
        }
    }

    function handleUpgradeAccount() {
        modal.show({
            title: 'Upgrade Account',
            text: 'Convert your guest account to a full account to save your data permanently. You\'ll need to provide an email and password.',
            confirmText: 'Continue',
            onConfirm: () => {
                modal.show({
                    title: 'Enter Email',
                    text: 'Provide an email address for your account.',
                    input: { placeholder: 'your@email.com', type: 'email' },
                    confirmText: 'Next',
                    onConfirm: (email) => {
                        if (!email.trim()) return;
                        modal.show({
                            title: 'Create Password',
                            text: `Create a password for ${email}`,
                            input: { placeholder: 'Password', type: 'password' },
                            confirmText: 'Upgrade Account',
                            onConfirm: async (password) => {
                                if (!password.trim()) return;
                                try {
                                    // This would require additional Firebase setup for account linking
                                    modal.show({ 
                                        title: 'Feature Coming Soon', 
                                        text: 'Account upgrade functionality will be available in a future update.', 
                                        confirmText: 'OK', 
                                        onConfirm: modal.hide 
                                    });
                                } catch (error) {
                                    modal.show({ title: 'Upgrade Failed', text: error.message, confirmText: 'OK', onConfirm: modal.hide });
                                }
                            },
                            cancelText: 'Cancel'
                        });
                    },
                    cancelText: 'Cancel'
                });
            },
            cancelText: 'Cancel'
        });
    }

    // --- App Logic Handlers ---
    
    function handleCreateGroup() {
        modal.show({
            title: 'Create New Group',
            text: 'Give your new group a name.',
            input: { placeholder: 'Group Name' },
            confirmText: 'Create',
            onConfirm: async (groupName) => {
                if (groupName.trim()) {
                    const inviteCode = Math.random().toString(36).substring(2, 8).toUpperCase();
                    await addDoc(collection(db, 'chats'), {
                        name: groupName.trim(),
                        type: 'group',
                        participants: [currentUser.uid],
                        createdBy: currentUser.uid,
                        createdAt: serverTimestamp(),
                        inviteCode: inviteCode
                    });
                    modal.hide();
                }
            }
        });
    }
    
    function handleJoinGroup() {
        modal.show({
            title: 'Join a Group',
            text: 'Enter the 6-character invite code.',
            input: { placeholder: 'ABCXYZ' },
            confirmText: 'Join',
            onConfirm: async (code) => {
                const inviteCode = code.trim().toUpperCase();
                if (inviteCode.length === 6) {
                    const q = query(collection(db, 'chats'), where('inviteCode', '==', inviteCode));
                    const querySnapshot = await getDocs(q);
                    if (!querySnapshot.empty) {
                        const chatDoc = querySnapshot.docs[0];
                        await updateDoc(chatDoc.ref, { participants: arrayUnion(currentUser.uid) });
                        modal.hide();
                    } else {
                        modal.show({ title: 'Error', text: 'Invalid invite code.', confirmText: 'OK', onConfirm: modal.hide });
                    }
                }
            }
        });
    }

    function handleChatOptions() {
        modal.show({
            title: 'Chat Options',
            text: `Invite Code: <strong>${currentChatInfo.inviteCode}</strong><br><br>What would you like to do?`,
            confirmText: 'Report a User',
            onConfirm: handleReportUserFlow,
            cancelText: 'Close'
        });
    }

    async function handleReportUserFlow() {
        const otherParticipants = currentChatInfo.participants.filter(uid => uid !== currentUser.uid);
        if (otherParticipants.length === 0) {
            modal.show({ title: 'Report User', text: 'There are no other users in this chat to report.', confirmText: 'OK', onConfirm: modal.hide });
            return;
        }

        // Fetch participant names
        const userPromises = otherParticipants.map(uid => getDoc(doc(db, "users", uid)));
        const userDocs = await Promise.all(userPromises);
        const usersToReport = userDocs.map(d => ({ id: d.id, ...d.data() }));

        let userSelectionHTML = 'Please select a user to report:<br><br>';
        usersToReport.forEach(user => {
            userSelectionHTML += `<button class="modal-btn" data-report-uid="${user.uid}">${user.displayName}</button><br>`;
        });

        modal.show({
            title: 'Report a User',
            text: userSelectionHTML,
            confirmText: 'Cancel',
            onConfirm: modal.hide
        });
        
        // Add event listeners to the new buttons inside the modal
        document.querySelectorAll('[data-report-uid]').forEach(button => {
            button.addEventListener('click', (e) => {
                const reportedUserId = e.target.dataset.reportUid;
                const reportedUserName = usersToReport.find(u=>u.uid === reportedUserId).displayName;
                promptForReportReason(reportedUserId, reportedUserName);
            });
        });
    }

    function promptForReportReason(reportedUserId, reportedUserName) {
        modal.show({
            title: `Report ${reportedUserName}`,
            text: `Please provide a reason for reporting this user.`,
            input: { placeholder: 'e.g., Spam, harassment...' },
            confirmText: 'Submit Report',
            onConfirm: async (reason) => {
                if (reason.trim()) {
                    await submitReport(reportedUserId, reason.trim());
                    modal.show({ title: 'Report Submitted', text: 'Thank you. Our moderators will review the report.', confirmText: 'OK', onConfirm: modal.hide });
                }
            },
            cancelText: 'Cancel'
        });
    }

    async function submitReport(reportedUserId, reason) {
        try {
            await addDoc(collection(db, "reports"), {
                reportedUserId: reportedUserId,
                reporterId: currentUser.uid,
                reason: reason,
                chatId: currentChatId,
                timestamp: serverTimestamp()
            });
        } catch (error) {
            console.error("Failed to submit report:", error);
            modal.show({ title: 'Error', text: 'Could not submit report. Please try again.', confirmText: 'OK', onConfirm: modal.hide });
        }
    }
    
    async function sendMessage(messageData) {
        if (!currentChatId) return;
        const payload = { ...messageData, senderId: currentUser.uid, senderName: currentUserProfile.displayName, createdAt: serverTimestamp() };
        await addDoc(collection(db, 'chats', currentChatId, 'messages'), payload);
    }

    function handleSendTextMessage() {
        const input = document.getElementById('message-input');
        const text = input.value.trim();
        if (text) {
            sendMessage({ text: text });
            input.value = '';
            input.focus();
        }
    }

    async function handleFileUpload(file) {
        if (!file.type.startsWith('image/')) {
            modal.show({ title: 'Upload Error', text: 'Only image files are allowed.', confirmText: 'OK', onConfirm: modal.hide });
            return;
        }
        modal.show({ title: 'Uploading...', text: 'Please wait while your image is uploaded.', cancelText: '' });

        try {
            const uploadConfigResponse = await fetch('/api/b2-upload-url', { method: 'POST' });
            if (!uploadConfigResponse.ok) throw new Error('Could not get upload URL.');
            const { uploadUrl, authorizationToken } = await uploadConfigResponse.json();

            const uploadResponse = await fetch(uploadUrl, {
                method: 'POST',
                headers: { 'Authorization': authorizationToken, 'X-Bz-File-Name': file.name, 'Content-Type': file.type, 'X-Bz-Content-Sha1': 'do_not_verify' },
                body: file
            });
            if (!uploadResponse.ok) throw new Error('File upload to B2 failed.');
            const b2File = await uploadResponse.json();

            const friendlyUrl = `https://f005.backblazeb2.com/file/dospill/${b2File.fileName}`;
            await sendMessage({ imageUrl: friendlyUrl });
            modal.hide();

        } catch (error) {
            console.error('File upload failed:', error);
            modal.show({ title: 'Upload Failed', text: 'There was an error uploading your image.', confirmText: 'OK', onConfirm: modal.hide });
        }
    }

    // --- Data Rendering & Listener Management ---
    
    function renderChatList() {
        const container = document.getElementById('chats-container');
        if (!container) return;
        const q = query(collection(db, 'chats'), where('participants', 'array-contains', currentUser.uid));
        
        const unsubscribe = onSnapshot(q, (snapshot) => {
            if (!document.getElementById('chats-container')) return;
            container.innerHTML = '';
            if (snapshot.empty) {
                container.innerHTML = `<p style="text-align: center; color: var(--medium-gray); padding: 20px;">You haven't joined any groups yet.</p>`;
            }
            snapshot.docs.forEach(doc => {
                const chat = doc.data();
                const el = document.createElement('div');
                el.className = 'chat-preview';
                el.innerHTML = `
                    <img src="https://placehold.co/100x100/2c2c2e/FFFFFF?text=${chat.name.charAt(0).toUpperCase()}" alt="group icon">
                    <div class="chat-info">
                        <h2>${chat.name}</h2>
                        <p>${chat.lastMessage || 'Tap to start chatting...'}</p>
                    </div>
                `;
                el.addEventListener('click', () => renderChatWindow(doc.id, chat));
                container.appendChild(el);
            });
        }, error => console.error("ChatList listener error:", error));
        activeListeners.set('chatList', unsubscribe);
    }
    
    function renderMessages(chatId) {
        const container = document.getElementById('messages-container');
        if (!container) return;
        const q = query(collection(db, 'chats', chatId, 'messages'), orderBy('createdAt', 'asc'));
        
        const unsubscribe = onSnapshot(q, (snapshot) => {
            if (!document.getElementById('messages-container')) return;
            container.innerHTML = '';
            snapshot.docs.forEach(doc => {
                const msg = doc.data();
                const el = document.createElement('div');
                const isSent = msg.senderId === currentUser.uid;
                el.className = `message-bubble ${isSent ? 'sent' : 'received'}`;
                
                let messageContent = '';
                if (msg.text) {
                    messageContent = `<div class="message-text">${msg.text}</div>`;
                } else if (msg.imageUrl) {
                    messageContent = `<img src="${msg.imageUrl}" class="message-image" alt="User uploaded image">`;
                }

                el.innerHTML = `
                    ${!isSent ? `<div class="sender-name">${msg.senderName}</div>` : ''}
                    ${messageContent}
                `;
                container.appendChild(el);
            });
            container.parentElement.scrollTop = container.parentElement.scrollHeight;
        }, error => console.error("Messages listener error:", error));
        activeListeners.set('messages', unsubscribe);
    }
    
    function detachAllListeners() {
        activeListeners.forEach(unsubscribe => unsubscribe());
        activeListeners.clear();
    }
});
