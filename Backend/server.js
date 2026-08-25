const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = 5000;
const JWT_SECRET = 'thrift_secret_key_change_in_production';

// Ensure uploads directory exists
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
}

// Middleware
app.use(cors());
app.use(express.json());
// Serve uploaded images statically
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Configure Multer for File Uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads/'),
  filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`)
});
const upload = multer({ storage });

// In-Memory Database (Replace with PostgreSQL or MongoDB in production)
let users = [];
let items = [
  {
    id: '1',
    userId: 'demo-user',
    title: '90s Graphic Vintage Tee',
    description: 'Authentic tour shirt, minor wear, size Large.',
    costPrice: 3.50,
    sellingPrice: 35.00,
    status: 'available',
    imageUrl: 'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?w=500'
  },
  {
    id: '2',
    userId: 'demo-user',
    title: 'Classic Denim Jacket',
    description: 'Heavyweight denim, vintage fade, size Medium.',
    costPrice: 12.00,
    sellingPrice: 55.00,
    status: 'sold',
    imageUrl: 'https://images.unsplash.com/photo-1576995853123-5a10305d93c0?w=500'
  }
];

// Auth Middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) return res.status(401).json({ error: 'Access denied, token missing' });

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Invalid token' });
    req.user = user;
    next();
  });
};

// ================= AUTH ROUTES =================

// Register
app.post('/api/auth/signup', async (req, res) => {
  const { email, password, storeName } = req.body;
  if (users.find(u => u.email === email)) {
    return res.status(400).json({ error: 'User already exists' });
  }

  const hashedPassword = await bcrypt.hash(password, 10);
  const newUser = {
    id: Date.now().toString(),
    email,
    password: hashedPassword,
    storeName: storeName || 'My Thrift Shop',
    bio: 'Welcome to my thrift store!'
  };
  users.push(newUser);

  const token = jwt.sign({ userId: newUser.id, email: newUser.email }, JWT_SECRET, { expiresIn: '7d' });
  res.status(201).json({ token, user: { email: newUser.email, storeName: newUser.storeName, bio: newUser.bio } });
});

// Login
app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  const user = users.find(u => u.email === email);

  if (!user || !(await bcrypt.compare(password, user.password))) {
    return res.status(400).json({ error: 'Invalid email or password' });
  }

  const token = jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET, { expiresIn: '7d' });
  res.json({ token, user: { email: user.email, storeName: user.storeName, bio: user.bio } });
});

// Update Profile
app.put('/api/auth/profile', authenticateToken, (req, res) => {
  const user = users.find(u => u.id === req.user.userId);
  if (!user) return res.status(404).json({ error: 'User not found' });

  user.storeName = req.body.storeName || user.storeName;
  user.bio = req.body.bio || user.bio;

  res.json({ user: { email: user.email, storeName: user.storeName, bio: user.bio } });
});

// ================= INVENTORY ROUTES =================

// Get All Items
app.get('/api/items', authenticateToken, (req, res) => {
  res.json(items);
});

// Add Item
app.post('/api/items', authenticateToken, upload.single('image'), (req, res) => {
  const { title, description, costPrice, sellingPrice } = req.body;
  
  const newItem = {
    id: Date.now().toString(),
    userId: req.user.userId,
    title,
    description,
    costPrice: parseFloat(costPrice),
    sellingPrice: parseFloat(sellingPrice),
    status: 'available',
    imageUrl: req.file ? `http://localhost:5000/uploads/${req.file.filename}` : ''
  };

  items.unshift(newItem);
  res.status(201).json(newItem);
});

// Toggle Sold Status
app.patch('/api/items/:id/status', authenticateToken, (req, res) => {
  const item = items.find(i => i.id === req.params.id);
  if (!item) return res.status(404).json({ error: 'Item not found' });

  item.status = item.status === 'available' ? 'sold' : 'available';
  res.json(item);
});

// Start Server
app.listen(PORT, () => console.log(`🚀 Thrift API running on http://localhost:${PORT}`));