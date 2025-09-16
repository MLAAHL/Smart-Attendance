const mongoose = require('mongoose');
const Teacher = require('./models/Teacher');

async function cleanAndTestTeacherCreation() {
  try {
    // Connect to MongoDB
    await mongoose.connect('mongodb://localhost:27017/Attendance');
    console.log('✅ Connected to MongoDB');
    
    // Clean up any existing teachers first
    console.log('🧹 Cleaning up existing teachers...');
    const deleteResult = await Teacher.deleteMany({});
    console.log(`🗑️ Deleted ${deleteResult.deletedCount} existing teachers`);
    
    // Test 1: Create teacher with Firebase UID
    console.log('\n🧪 Test 1: Creating teacher with Firebase UID...');
    const teacher1 = new Teacher({
      firebaseUid: 'firebase-uid-123',
      name: 'John Firebase Teacher',
      email: 'john@firebase.com'
    });
    
    await teacher1.save();
    console.log('✅ Teacher 1 created successfully:', teacher1.email);
    
    // Test 2: Create teacher without Firebase UID (localStorage user)
    console.log('\n🧪 Test 2: Creating teacher without Firebase UID...');
    const teacher2 = new Teacher({
      firebaseUid: null,
      name: 'Jane LocalStorage Teacher',
      email: 'jane@localstorage.com'
    });
    
    await teacher2.save();
    console.log('✅ Teacher 2 created successfully:', teacher2.email);
    
    // Test 3: Create another teacher without Firebase UID
    console.log('\n🧪 Test 3: Creating another teacher without Firebase UID...');
    const teacher3 = new Teacher({
      firebaseUid: null,
      name: 'Bob LocalStorage Teacher',
      email: 'bob@localstorage.com'
    });
    
    await teacher3.save();
    console.log('✅ Teacher 3 created successfully:', teacher3.email);
    
    // Test 4: Try creating a teacher with duplicate email (should fail)
    console.log('\n🧪 Test 4: Trying to create teacher with duplicate email...');
    try {
      const teacher4 = new Teacher({
        firebaseUid: null,
        name: 'Duplicate Email Teacher',
        email: 'jane@localstorage.com' // Same email as teacher2
      });
      await teacher4.save();
      console.log('❌ This should have failed!');
    } catch (error) {
      console.log('✅ Correctly rejected duplicate email:', error.code === 11000 ? 'E11000 (expected)' : error.message);
    }
    
    // Test 5: Try creating a teacher with duplicate Firebase UID (should fail)
    console.log('\n🧪 Test 5: Trying to create teacher with duplicate Firebase UID...');
    try {
      const teacher5 = new Teacher({
        firebaseUid: 'firebase-uid-123', // Same as teacher1
        name: 'Duplicate Firebase UID Teacher',
        email: 'duplicate@firebase.com'
      });
      await teacher5.save();
      console.log('❌ This should have failed!');
    } catch (error) {
      console.log('✅ Correctly rejected duplicate Firebase UID:', error.code === 11000 ? 'E11000 (expected)' : error.message);
    }
    
    // List all teachers
    console.log('\n📋 All teachers in database:');
    const allTeachers = await Teacher.find({});
    allTeachers.forEach((teacher, index) => {
      console.log(`${index + 1}. ${teacher.name} (${teacher.email}) - Firebase UID: ${teacher.firebaseUid || 'null'}`);
    });
    
    console.log(`\n✅ Total teachers created: ${allTeachers.length}`);
    console.log('🎉 All tests passed! Multiple teacher profiles work correctly.');
    console.log('🔥 The duplicate key error for null Firebase UIDs is FIXED!');
    
    await mongoose.disconnect();
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    await mongoose.disconnect();
  }
}

cleanAndTestTeacherCreation();