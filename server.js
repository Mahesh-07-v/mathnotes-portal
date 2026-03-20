require('dotenv').config();
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');

// Connect to DB
mongoose.connect(process.env.MONGO_URI)
.then(() => console.log('MongoDB Connected'))
.catch(err => console.log(err));

// Create Schema
const StateSchema = new mongoose.Schema({
  profile: Object,
  research: Array,
  courses: Array
});

const State = mongoose.model('State', StateSchema);

const app = express();
const port = process.env.PORT || 3000;
const isProd = process.env.NODE_ENV === 'production';

// Enable CORS (allow the frontend to talk to the backend)
app.use(cors());
// Parse JSON payloads for state updates
app.use(express.json({ limit: '10mb' }));

// Directories for state
const DATA_FILE = path.join(__dirname, 'state.json');

// Serve all static files (like web.html and resources)
app.use(express.static(path.join(__dirname)));

// Route root to the web.html application
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'web.html'));
});

// Configure Multer and Cloudinary for file uploads
const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');

cloudinary.config({
  cloud_name: process.env.CLOUD_NAME,
  api_key: process.env.API_KEY,
  api_secret: process.env.API_SECRET
});

const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'prof-portal',
    resource_type: 'auto' // IMPORTANT for PDFs
  }
});

const upload = multer({ storage: storage });

// Default initial state
const defaultState = {
  profile: {
    fullname: 'Dr. Alan Carter', firstname: 'Alan', lastname: 'Carter',
    title: 'Associate Professor · University of Westbridge',
    email: 'alan.carter@westbridge.edu',
    shortBio: 'Passionate about making mathematics beautiful, accessible, and alive. My door is always open.',
    fullBio: '', years: '14', photo: null,
    interests: ['PDEs', 'Topology', 'Fluid Dynamics'],
    office: 'Math Building, Room 214', hours: 'Mon & Wed 2–4 PM · Fri 10 AM–12 PM',
    adminPassword: 'admin123'
  },
  research: [],
  courses: []
};

// API: Get current state
app.get('/api/state', async (req, res) => {
  try {
    let state = await State.findOne();

    if (!state) {
      state = await State.create(defaultState);
    }

    res.json(state);
  } catch (error) {
    console.error("Error fetching state:", error);
    res.status(500).json(defaultState);
  }
});

// API: Save state updates
app.post('/api/state', async (req, res) => {
  try {
    await State.findOneAndUpdate({}, req.body, { upsert: true });
    res.json({ success: true });
  } catch (error) {
    console.error("Error saving state:", error);
    res.status(500).json({ success: false });
  }
});

// API: Verify Login
app.post('/api/login', async (req, res) => {
  try {
    let currentState = await State.findOne();
    if (!currentState) {
      currentState = defaultState;
    }
    
    const pw = currentState.profile?.adminPassword || 'admin123';
    if (req.body.password === pw) {
      res.json({ success: true, isDefault: pw === 'admin123' });
    } else {
      res.json({ success: false });
    }
  } catch (error) {
    res.status(500).json({ success: false });
  }
});

// API: Change Password
app.post('/api/change-password', async (req, res) => {
  try {
    let currentState = await State.findOne();
    if (!currentState) {
      currentState = new State(defaultState);
    } else if (typeof currentState.toObject === 'function') {
      currentState = currentState.toObject();
    }
    
    if (!currentState.profile) currentState.profile = {};
    currentState.profile.adminPassword = req.body.newPassword;
    delete currentState._id;
    
    await State.findOneAndUpdate({}, currentState, { upsert: true });
    res.json({ success: true });
  } catch (error) {
    console.error("Change password error:", error);
    res.status(500).json({ success: false });
  }
});

// API: Upload a file (Photo or PDF Note)
app.post('/api/upload', upload.single('file'), (req, res) => {
  try {
    res.json({
      success: true,
      fileUrl: req.file.path // Cloudinary URL
    });
  } catch (err) {
    res.status(500).json({ success: false });
  }
});

app.listen(port, () => {
  console.log(`Prof Portal Backend running at http://localhost:${port}`);
});
