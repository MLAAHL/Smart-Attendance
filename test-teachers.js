const mongoose = require('mongoose');
const Teacher = require('./models/Teacher');

async function testTeacherCreation() {
  try {
    // Connect to MongoDB
    await mongoose.connect('mongodb://localhost:27017/Attendance');
    console.log('✅ Connected to MongoDB');
    
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
    
    // List all teachers
    console.log('\n📋 All teachers in database:');
    const allTeachers = await Teacher.find({});
    allTeachers.forEach((teacher, index) => {
      console.log(`${index + 1}. ${teacher.name} (${teacher.email}) - Firebase UID: ${teacher.firebaseUid || 'null'}`);
    });
    
    console.log(`\n✅ Total teachers created: ${allTeachers.length}`);
    
    await mongoose.disconnect();
    console.log('\n🎉 All tests passed! Multiple teacher profiles work correctly.');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    await mongoose.disconnect();
  }
}

testTeacherCreation();