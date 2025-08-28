// Test script to verify server API endpoints
const API_BASE_URL = 'http://localhost:3000'; // Change this to your API URL
const SAVE_PATH = '/api/saves';

async function testAPI() {
  console.log('Testing Server Drive API endpoints...\n');
  
  // Test 1: List files
  console.log('1. Testing LIST endpoint (GET /api/saves)');
  try {
    const response = await fetch(`${API_BASE_URL}${SAVE_PATH}`);
    console.log(`   Status: ${response.status}`);
    if (response.ok) {
      const files = await response.json();
      console.log(`   Success! Found ${files.length} files`);
      if (files.length > 0) {
        console.log(`   First file:`, files[0]);
      }
    } else {
      console.log(`   Error: ${response.statusText}`);
    }
  } catch (error) {
    console.log(`   Failed: ${error.message}`);
  }
  
  // Test 2: Save a file
  console.log('\n2. Testing SAVE endpoint (PUT /api/saves/test.excalidraw)');
  const testData = {
    type: "excalidraw",
    version: 2,
    source: "test",
    elements: [],
    appState: {
      viewBackgroundColor: "#ffffff"
    },
    files: {}
  };
  
  try {
    const response = await fetch(`${API_BASE_URL}${SAVE_PATH}/test.excalidraw`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(testData)
    });
    console.log(`   Status: ${response.status}`);
    if (response.ok) {
      console.log(`   Success! File saved`);
    } else {
      console.log(`   Error: ${response.statusText}`);
    }
  } catch (error) {
    console.log(`   Failed: ${error.message}`);
  }
  
  // Test 3: Load the file
  console.log('\n3. Testing LOAD endpoint (GET /api/saves/test.excalidraw)');
  try {
    const response = await fetch(`${API_BASE_URL}${SAVE_PATH}/test.excalidraw`);
    console.log(`   Status: ${response.status}`);
    if (response.ok) {
      const data = await response.json();
      console.log(`   Success! Loaded file with type: ${data.type}`);
    } else {
      console.log(`   Error: ${response.statusText}`);
    }
  } catch (error) {
    console.log(`   Failed: ${error.message}`);
  }
  
  // Test 4: Delete the file
  console.log('\n4. Testing DELETE endpoint (DELETE /api/saves/test.excalidraw)');
  try {
    const response = await fetch(`${API_BASE_URL}${SAVE_PATH}/test.excalidraw`, {
      method: 'DELETE'
    });
    console.log(`   Status: ${response.status}`);
    if (response.ok) {
      console.log(`   Success! File deleted`);
    } else {
      console.log(`   Error: ${response.statusText}`);
    }
  } catch (error) {
    console.log(`   Failed: ${error.message}`);
  }
  
  console.log('\n=== API Test Complete ===');
  console.log('\nIf all tests failed, you need to implement a server with these endpoints:');
  console.log('- GET    /api/saves           - List files (returns array of {name, path, size, modified})');
  console.log('- GET    /api/saves/:filename - Load a file (returns JSON content)');
  console.log('- PUT    /api/saves/:filename - Save a file (body: JSON content)');
  console.log('- DELETE /api/saves/:filename - Delete a file');
}

// Run with Node.js 18+ (has built-in fetch)
testAPI();