    import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-app.js";
    import { getDatabase, ref, push, onChildAdded, onChildRemoved, remove, onValue, set, off } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-database.js";
    import { getStorage, ref as storageRef, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-storage.js";

    const firebaseConfig = {
      apiKey: "AIzaSyDhYta0w2K_DQwa0SlBDA3FnfRNqog-ejE",
      authDomain: "imagefeed-45d0e.firebaseapp.com",
      databaseURL: "https://imagefeed-45d0e-default-rtdb.firebaseio.com",
      projectId: "imagefeed-45d0e",
      storageBucket: "imagefeed-45d0e.firebasestorage.app",
      messagingSenderId: "886161237670",
      appId: "1:886161237670:web:105822aeb49c11340d7667"
    };

    const app = initializeApp(firebaseConfig);
    const db = getDatabase(app);
    const storage = getStorage(app);
    const chatRef = ref(db, 'globalChat');
    const activeUsersRef = ref(db, 'activeUsers');
    const kickedUsersRef = ref(db, 'kickedUsers');
    const noticeRef = ref(db, 'notice/currentNotice'); // Reference to notice in Firebase

    let username = "";
    let currentUserId = null;
    let userKickListener = null;

    // Fetch notice from Firebase
    function fetchNotice() {
      onValue(noticeRef, (snapshot) => {
        const notice = snapshot.val();
        const noticeContainer = document.getElementById('noticeContainer');
        if (notice) {
          document.getElementById('noticeContent').textContent = notice;
        } else {
          document.getElementById('noticeContent').textContent = "No current notices";
        }
      });
    }

    // Call fetchNotice when the page loads
    fetchNotice();

    function checkIfKicked() {
      if (!currentUserId) return;
      
      userKickListener = onValue(ref(db, `kickedUsers/${currentUserId}`), (snapshot) => {
        if (snapshot.exists()) {
          handleKick();
          remove(ref(db, `kickedUsers/${currentUserId}`));
        }
      });
    }

    function handleKick() {
      logout();
      document.getElementById('chatRoom').style.display = 'none';
      document.getElementById('joinForm').style.display = 'none';
      document.getElementById('kickedMessage').style.display = 'block';
      
      setTimeout(() => {
        document.getElementById('kickedMessage').style.display = 'none';
        document.getElementById('joinForm').style.display = 'block';
      }, 5000);
    }

    window.joinChat = () => {
      const nameInput = document.getElementById('username');
      const codeInput = document.getElementById('joinCode');
      const errorElement = document.getElementById('joinError');
      
      const name = nameInput.value.trim();
      const code = codeInput.value;
      
      if (!name || name.length < 3) {
        errorElement.textContent = "Username must be at least 3 characters";
        return;
      }
      
      if (code !== '2001') {
        errorElement.textContent = "Invalid join code";
        return;
      }
      
      errorElement.textContent = '';
      
      username = name;
      currentUserId = Date.now().toString();
      document.getElementById('joinForm').style.display = 'none';
      document.getElementById('chatRoom').style.display = 'block';
      document.getElementById('noticeContainer').style.display = 'none'; // Hide notice panel when in chat
      
      document.getElementById('imageUpload').addEventListener('change', handleImageUpload);
      
      set(ref(db, `activeUsers/${currentUserId}`), username);
      
      checkIfKicked();
      
      window.addEventListener('beforeunload', () => {
        remove(ref(db, `activeUsers/${currentUserId}`));
      });
    };

    window.logout = () => {
      if (currentUserId) {
        remove(ref(db, `activeUsers/${currentUserId}`));
      }
      username = "";
      currentUserId = null;
      document.getElementById('joinForm').style.display = 'block';
      document.getElementById('chatRoom').style.display = 'none';
      document.getElementById('noticeContainer').style.display = 'block'; // Show notice panel when logged out
      document.getElementById('messages').innerHTML = '';
      document.getElementById('joinError').textContent = '';
      
      if (userKickListener) {
        off(ref(db, `kickedUsers/${currentUserId}`), userKickListener);
        userKickListener = null;
      }
    };

    async function handleImageUpload(e) {
      const file = e.target.files[0];
      if (!file) return;
      
      if (file.size > 2 * 1024 * 1024) {
        alert("IMAGE TOO LARGE (MAX 2MB)");
        return;
      }
      
      try {
        const storageReference = storageRef(storage, `chat_images/${Date.now()}_${file.name}`);
        await uploadBytes(storageReference, file);
        const imageUrl = await getDownloadURL(storageReference);
        
        push(chatRef, {
          name: username,
          imageUrl: imageUrl,
          timestamp: Date.now(),
          userId: currentUserId
        });
        
        e.target.value = '';
      } catch (error) {
        console.error("UPLOAD ERROR:", error);
        alert("UPLOAD FAILED");
      }
    }

    window.sendMessage = () => {
      const msg = document.getElementById('messageInput').value.trim();
      if (msg !== '') {
        push(chatRef, {
          name: username,
          message: msg,
          timestamp: Date.now(),
          userId: currentUserId
        });
        document.getElementById('messageInput').value = '';
      }
    };

    onChildAdded(chatRef, (data) => {
      const { name, message, imageUrl } = data.val();
      const msgDiv = document.createElement('div');
      msgDiv.className = imageUrl ? 'msg img-msg' : 'msg';
      msgDiv.id = data.key;
      
      if (imageUrl) {
        msgDiv.innerHTML = `
          <strong>${name}</strong> sent an image:
          <br><img src="${imageUrl}" />
        `;
      } else {
        msgDiv.innerHTML = `
          <strong>${name}</strong>: ${message}
        `;
      }
      
      const msgContainer = document.getElementById('messages');
      msgContainer.appendChild(msgDiv);
      msgContainer.scrollTop = msgContainer.scrollHeight;
    });

    onChildRemoved(chatRef, (data) => {
      const messageElement = document.getElementById(data.key);
      if (messageElement) {
        messageElement.remove();
      }
    });

    // Disable right-click
    document.addEventListener('contextmenu', event => event.preventDefault());

    // Disable F12, Ctrl+Shift+I, Ctrl+U, etc.
    document.addEventListener('keydown', event => {
      if (
        event.key === 'F12' ||
        (event.ctrlKey && event.shiftKey && (event.key === 'I' || event.key === 'J')) ||
        (event.ctrlKey && event.key === 'U')
      ) {
        event.preventDefault();
      }
    });
