// js/app.js

import {
    getAuth,
    onAuthStateChanged,
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    signOut,
    updateProfile
} from "https://www.gstatic.com/firebasejs/9.6.1/firebase-auth.js";
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
    orderBy
} from "https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js";
import {
    getStorage,
    ref,
    uploadBytes,
    getDownloadURL
} from "https://www.gstatic.com/firebasejs/9.6.1/firebase-storage.js";


document.addEventListener('DOMContentLoaded', () => {
    // --- Firebase Services ---
    const auth = getAuth();
    const db = getFirestore();
    const storage = getStorage();

    // --- App State ---
    const root = document.getElementById('root');
    let currentUser = null;
    let currentUserProfile = null;
    let currentChatId = null;
    let isLoginView = true;
    let messageUnsubscribe = null; // To detach listeners

    // --- Auth State Observer ---
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            const userDoc = await getDoc(doc(db, "users", user.uid));
            if (userDoc.exists() && userDoc.data().isBanned) {
                await signOut(auth);
                renderAuth("You have been banned from this service.");
                return;
            }
            currentUser = user;
            currentUserProfile = userDoc.data();
            renderApp();
        } else {
            currentUser = null;
            currentUserProfile = null;
            if (messageUnsubscribe) messageUnsubscribe(); // Clean up listener
            renderAuth();
        }
    });

    // --- Render Functions ---

    function renderAuth(errorMessage = '') {
        root.innerHTML = `
            <div class="auth-container">
                <h1>${isLoginView ? 'Welcome Back' : 'Create Account'}</h1>
                <form class="auth-form" id="auth-form">
                    <input type="email" id="email" placeholder="Email" required>
                    <input type="password" id="password" placeholder="Password" required>
                    ${!isLoginView ? '<input type="text" id="username" placeholder="Username" required>' : ''}
                    <button type="submit">${isLoginView ? 'Log In' : 'Sign Up'}</button>
                    ${errorMessage ? `<p class="error-message">${errorMessage}</p>` : ''}
                </form>
                <button class="toggle-auth" id="toggle-auth-btn">
                    ${isLoginView ? 'Need an account? Sign Up' : 'Have an account? Log In'}
                </button>
            </div>
        `;
        addAuthEventListeners();
    }

    function renderApp() {
        root.innerHTML = `
            <div class="app-container">
                <header class="chat-list-header">
                    <button id="profile-btn">Profile</button>
                    <h1>Chats</h1>
                    <button id="logout-btn">Logout</button>
                </header>
                <main class="chat-list" id="chat-list-container">
                    <!-- Chat previews will be rendered here -->
                </main>
                <button id="new-chat-btn">+</button>
            </div>
        `;
        addAppEventListeners();
        renderChatList();
    }

    function renderChatWindow(chatId, recipientInfo) {
        currentChatId = chatId;
        root.innerHTML = `
             <div class="chat-window">
                <header class="chat-header">
                    <button class="back-button" id="back-to-chats">&lt;</button>
                    <div class="chat-header-info" id="chat-header-info" data-recipient-id="${recipientInfo.uid}">
                        <img src="${recipientInfo.profilePicture || '/icons/default-profile.png'}" alt="pfp">
                        <h2>${recipientInfo.username || 'Chat'}</h2>
                    </div>
                </header>
                <div class="message-area" id="message-area">
                   <div class="messages-container" id="messages-container"></div>
                </div>
                <footer class="message-input-area">
                    <input type="file" id="image-upload-input" style="display: none;" accept="image/*">
                    <button id="image-upload-btn">+</button>
                    <input type="text" class="message-input" id="message-input" placeholder="Message...">
                    <button class="send-button" id="send-btn">Send</button>
                </footer>
            </div>
        `;
        addChatWindowEventListeners();
        renderMessages(chatId);
    }

    function renderProfile() {
        const pronouns = currentUserProfile.pronouns || 'Prefer not to say';
        root.innerHTML = `
            <div class="profile-container">
                <header>
                    <button id="back-to-chats-from-profile">Back</button>
                    <h1>Edit Profile</h1>
                    <button id="save-profile-btn">Save</button>
                </header>
                <main>
                    <div class="pfp-section">
                        <img src="${currentUserProfile.profilePicture}" id="profile-img-preview" alt="Profile Picture">
                        <input type="file" id="pfp-upload" style="display:none;" accept="image/*">
                        <button id="change-pfp-btn">Change Picture</button>
                    </div>
                    <div class="profile-field">
                        <label for="username-input">Username</label>
                        <input type="text" id="username-input" value="${currentUserProfile.username}">
                    </div>
                    <div class="profile-field">
                        <label for="pronouns-select">Pronouns</label>
                        <select id="pronouns-select">
                            <option ${pronouns === 'he/him' ? 'selected' : ''}>he/him</option>
                            <option ${pronouns === 'she/her' ? 'selected' : ''}>she/her</option>
                            <option ${pronouns === 'they/them' ? 'selected' : ''}>they/them</option>
                            <option value="other" ${!['he/him', 'she/her', 'they/them', 'Prefer not to say'].includes(pronouns) ? 'selected' : ''}>Other</option>
                            <option ${pronouns === 'Prefer not to say' ? 'selected' : ''}>Prefer not to say</option>
                        </select>
                        <input type="text" id="pronouns-other-input" style="display:none;" placeholder="Please specify">
                    </div>
                </main>
            </div>
        `;
        addProfileEventListeners();
    }

    // --- Event Listeners & Handlers ---

    function handleAuthSubmit(e) {
        e.preventDefault();
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;

        if (isLoginView) {
            signInWithEmailAndPassword(auth, email, password).catch(err => renderAuth(err.message));
        } else {
            const username = document.getElementById('username').value;
            createUserWithEmailAndPassword(auth, email, password)
                .then(cred => {
                    setDoc(doc(db, "users", cred.user.uid), {
                        uid: cred.user.uid,
                        email: email,
                        username: username,
                        profilePicture: '/icons/default-profile.png',
                        createdAt: serverTimestamp(),
                        pronouns: 'Prefer not to say'
                    });
                })
                .catch(err => renderAuth(err.message));
        }
    }

    function handleSendMessage() {
        const messageInput = document.getElementById('message-input');
        const messageText = messageInput.value.trim();
        if (messageText && currentChatId) {
            addDoc(collection(db, "chats", currentChatId, "messages"), {
                text: messageText,
                senderId: currentUser.uid,
                createdAt: serverTimestamp(),
                type: 'text'
            });
            messageInput.value = '';
        }
    }
    
    function handleImageUpload(e) {
        const file = e.target.files[0];
        if (!file || !currentChatId) return;

        const storageRef = ref(storage, `chat_images/${currentChatId}/${Date.now()}_${file.name}`);
        uploadBytes(storageRef, file).then(snapshot => {
            getDownloadURL(snapshot.ref).then(downloadURL => {
                addDoc(collection(db, "chats", currentChatId, "messages"), {
                    imageUrl: downloadURL,
                    senderId: currentUser.uid,
                    createdAt: serverTimestamp(),
                    type: 'image'
                });
            });
        });
    }
    
    async function handleSaveProfile() {
        const newUsername = document.getElementById('username-input').value;
        const pronounsSelect = document.getElementById('pronouns-select');
        let newPronouns = pronounsSelect.value;
        if (newPronouns === 'other') {
            newPronouns = document.getElementById('pronouns-other-input').value;
        }

        const updates = {
            username: newUsername,
            pronouns: newPronouns
        };
        
        const pfpFile = document.getElementById('pfp-upload').files[0];
        if (pfpFile) {
            const pfpRef = ref(storage, `profile_pictures/${currentUser.uid}`);
            await uploadBytes(pfpRef, pfpFile);
            updates.profilePicture = await getDownloadURL(pfpRef);
        }

        await updateDoc(doc(db, "users", currentUser.uid), updates);
        await updateProfile(currentUser, { displayName: newUsername }); // Update auth profile too
        currentUserProfile = { ...currentUserProfile, ...updates }; // Update local profile state
        renderApp();
    }
    
    function handleReportUser(recipientId) {
        const reason = prompt("Why are you reporting this user?");
        if (reason && reason.trim() !== '') {
            addDoc(collection(db, "reports"), {
                reportedUserId: recipientId,
                reporterId: currentUser.uid,
                reason: reason,
                timestamp: serverTimestamp()
            }).then(() => {
                alert("User reported. Thank you.");
            });
        }
    }


    // --- Add Event Listener Functions ---
    const addAuthEventListeners = () => document.getElementById('auth-form').addEventListener('submit', handleAuthSubmit);
    const addAppEventListeners = () => {
        document.getElementById('logout-btn').addEventListener('click', () => signOut(auth));
        document.getElementById('profile-btn').addEventListener('click', renderProfile);
    };
    const addChatWindowEventListeners = () => {
        document.getElementById('back-to-chats').addEventListener('click', renderApp);
        document.getElementById('send-btn').addEventListener('click', handleSendMessage);
        document.getElementById('image-upload-btn').addEventListener('click', () => document.getElementById('image-upload-input').click());
        document.getElementById('image-upload-input').addEventListener('change', handleImageUpload);
        document.getElementById('chat-header-info').addEventListener('click', (e) => {
            const recipientId = e.currentTarget.dataset.recipientId;
            if (confirm("Do you want to report this user?")) {
                handleReportUser(recipientId);
            }
        });
    };
    const addProfileEventListeners = () => {
        document.getElementById('back-to-chats-from-profile').addEventListener('click', renderApp);
        document.getElementById('save-profile-btn').addEventListener('click', handleSaveProfile);
        document.getElementById('change-pfp-btn').addEventListener('click', () => document.getElementById('pfp-upload').click());
        document.getElementById('pfp-upload').addEventListener('change', (e) => {
            const reader = new FileReader();
            reader.onload = (event) => { document.getElementById('profile-img-preview').src = event.target.result; };
            reader.readAsDataURL(e.target.files[0]);
        });
        const pronounsSelect = document.getElementById('pronouns-select');
        const otherInput = document.getElementById('pronouns-other-input');
        pronounsSelect.addEventListener('change', () => {
            otherInput.style.display = pronounsSelect.value === 'other' ? 'block' : 'none';
        });
        if (pronounsSelect.value === 'other') otherInput.style.display = 'block';
    };


    // --- Data Rendering ---
    function renderChatList() {
        const q = query(collection(db, "chats"), where("participants", "array-contains", currentUser.uid));
        onSnapshot(q, (snapshot) => {
            const container = document.getElementById('chat-list-container');
            if (!container) return;
            container.innerHTML = '';
            snapshot.forEach(async (doc) => {
                const chat = doc.data();
                const recipientId = chat.participants.find(p => p !== currentUser.uid);
                if (recipientId) {
                    const userDoc = await getDoc(doc(db, "users", recipientId));
                    if(userDoc.exists()) {
                        const recipientInfo = userDoc.data();
                        const el = document.createElement('div');
                        el.className = 'chat-preview';
                        el.innerHTML = `<img src="${recipientInfo.profilePicture}" alt="pfp"><div class="chat-info"><h2>${recipientInfo.username}</h2><p>${chat.lastMessage || '...'}</p></div>`;
                        el.addEventListener('click', () => renderChatWindow(doc.id, recipientInfo));
                        container.appendChild(el);
                    }
                }
            });
        });
    }

    function renderMessages(chatId) {
        const q = query(collection(db, "chats", chatId, "messages"), orderBy("createdAt", "asc"));
        messageUnsubscribe = onSnapshot(q, (snapshot) => {
            const container = document.getElementById('messages-container');
            if (!container) return;
            container.innerHTML = '';
            snapshot.forEach(doc => {
                const msg = doc.data();
                const el = document.createElement('div');
                el.className = `message-bubble ${msg.senderId === currentUser.uid ? 'sent' : 'received'}`;
                if (msg.type === 'image') {
                    el.innerHTML = `<img src="${msg.imageUrl}" class="message-image" alt="Sent image">`;
                } else {
                    el.textContent = msg.text;
                }
                container.appendChild(el);
            });
            container.parentElement.scrollTop = container.parentElement.scrollHeight;
        });
    }
});
