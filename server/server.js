const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3000;

// Middleware to parse JSON and allow Cross-Origin Requests
app.use(cors());
app.use(express.json());

// Set up the specific data folder and file path
const dataDir = path.join(__dirname, 'data');
const dataFile = path.join(dataDir, 'expenses.json');

// Check if the directory and file exist, if not, create them
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir);
  console.log('Created data folder automatically.');
}

if (!fs.existsSync(dataFile)) {
  fs.writeFileSync(dataFile, JSON.stringify([]));
  console.log('Created empty expenses.json file.');
}

// Reusable functions to read from and write to the JSON file
const readExpenses = () => {
  try {
    const rawData = fs.readFileSync(dataFile, 'utf8');
    return JSON.parse(rawData);
  } catch (err) {
    console.error('Failed reading expenses.json:', err);
    return [];
  }
};

const writeExpenses = (expensesData) => {
  try {
    fs.writeFileSync(dataFile, JSON.stringify(expensesData, null, 2));
  } catch (err) {
    console.error('Failed writing to expenses.json:', err);
  }
};

// =======================
//   API ENDPOINTS
// =======================

// 1. GET /expenses -> Fetch all saved expenses
app.get('/expenses', (req, res) => {
  const expenses = readExpenses();
  res.json(expenses);
});

// 2. POST /add-expense -> Add a new expense
app.post('/add-expense', (req, res) => {
  const newExpense = req.body;

  // Basic error handling for missing data
  if (!newExpense.amount || !newExpense.category || !newExpense.date) {
    return res.status(400).json({ error: 'Missing required expense fields' });
  }

  const expenses = readExpenses();
  expenses.unshift(newExpense); // Put newest expense first
  
  writeExpenses(expenses);
  
  res.status(201).json({ message: 'Expense added correctly', expense: newExpense });
});

// 3. PUT /expense/:id -> Update an existing expense (Bonus)
app.put('/expense/:id', (req, res) => {
  const idToUpdate = req.params.id;
  const updatedData = req.body;
  
  const expenses = readExpenses();
  const expenseIndex = expenses.findIndex(exp => exp.id === idToUpdate);
  
  if (expenseIndex === -1) {
    return res.status(404).json({ error: 'Sorry, that expense was not found' });
  }

  // Update exactly the fields the frontend sent, keeping others intact
  expenses[expenseIndex] = { 
    ...expenses[expenseIndex], 
    ...updatedData, 
    updatedAt: new Date().toISOString() 
  };
  
  writeExpenses(expenses);

  res.json({ message: 'Expense updated successfully', expense: expenses[expenseIndex] });
});

// 4. DELETE /expense/:id -> Remove an expense (Bonus)
app.delete('/expense/:id', (req, res) => {
  const idToDelete = req.params.id;
  
  let expenses = readExpenses();
  const originalCount = expenses.length;
  
  // Filter out the expense that matches the ID
  expenses = expenses.filter(exp => exp.id !== idToDelete);
  
  if (expenses.length === originalCount) {
    return res.status(404).json({ error: 'Sorry, that expense was not found' });
  }

  writeExpenses(expenses);
  res.json({ message: 'Expense deleted successfully' });
});

// Start listening for traffic
app.listen(PORT, () => {
  console.log(`Backend Server is running perfectly on http://localhost:${PORT}`);
});
