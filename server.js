const express = require('express');
const cors = require('cors');
const multer = require('multer');
const fs = require('fs');
const path = require('path');

const app = express();
const port = process.env.PORT || 3000;
const isProd = process.env.NODE_ENV === 'production';

// Enable CORS (allow the frontend to talk to the backend)
app.use(cors());
// Parse JSON payloads for state updates
app.use(express.json({ limit: '10mb' }));

// Directories for state and uploaded files
const DATA_FILE = path.join(__dirname, 'state.json');
const UPLOADS_DIR = path.join(__dirname, 'uploads');

// Ensure uploads directory exists
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR);
}

// Serve uploaded files statically
app.use('/uploads', express.static(UPLOADS_DIR));
// Serve all static files (like web.html and resources)
app.use(express.static(path.join(__dirname)));

// Route root to the web.html application
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'web.html'));
});

// Configure Multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, UPLOADS_DIR);
  },
  filename: function (req, file, cb) {
    // Generate a unique filename using timestamp and original name
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + '-' + file.originalname);
  }
});
const upload = multer({ 
  storage: storage,
  limits: { fileSize: 100 * 1024 * 1024 } // 100MB file size limit
});

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
app.get('/api/state', (req, res) => {
  if (fs.existsSync(DATA_FILE)) {
    try {
      const data = fs.readFileSync(DATA_FILE, 'utf8');
      res.json(JSON.parse(data));
    } catch (e) {
      console.error("Error reading state.json", e);
      res.json(defaultState);
    }
  } else {
    // If no state file exists, return the default state
    res.json(defaultState);
  }
});

// API: Save state updates
app.post('/api/state', (req, res) => {
  try {
    const newState = req.body;
    fs.writeFileSync(DATA_FILE, JSON.stringify(newState, null, 2), 'utf8');
    res.json({ success: true, message: 'State saved successfully' });
  } catch (error) {
    console.error("Error writing state.json", error);
    res.status(500).json({ success: false, error: 'Failed to save state' });
  }
});

// API: Verify Login
app.post('/api/login', (req, res) => {
  let currentState = defaultState;
  if (fs.existsSync(DATA_FILE)) {
    try {
      currentState = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    } catch(e) {}
  }
  
  const pw = currentState.profile.adminPassword || 'admin123';
  if (req.body.password === pw) {
    res.json({ success: true, isDefault: pw === 'admin123' });
  } else {
    res.json({ success: false });
  }
});

// API: Change Password
app.post('/api/change-password', (req, res) => {
  try {
    let currentState = defaultState;
    if (fs.existsSync(DATA_FILE)) {
      currentState = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    }
    currentState.profile.adminPassword = req.body.newPassword;
    fs.writeFileSync(DATA_FILE, JSON.stringify(currentState, null, 2), 'utf8');
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false });
  }
});

// API: Upload a file (Photo or PDF Note)
app.post('/api/upload', upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }
  
  // Construct the publicly accessible URL for the uploaded file
  // Use relative path or configured domain based on environment
  const fileUrl = isProd 
    ? `/uploads/${req.file.filename}` 
    : `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`;
  
  res.json({
    success: true,
    fileUrl: fileUrl,
    filename: req.file.originalname,
    mimetype: req.file.mimetype,
    size: req.file.size
  });
});

app.listen(port, () => {
  console.log(`Prof Portal Backend running at http://localhost:${port}`);
  console.log(`Uploads will be saved to ${UPLOADS_DIR}`);
});
