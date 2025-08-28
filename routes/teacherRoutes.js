const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
const BaseAttendance = require("../models/BaseAttendance");
const sendWhatsAppMessage = require('../utils/sendWhatsAppMessage');

// ✅ ENHANCED: Student Schema with Language Support
const studentSchema = new mongoose.Schema({
  studentID: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    uppercase: true
  },
  name: {
    type: String,
    required: true,
    trim: true,
    uppercase: true
  },
  stream: {
    type: String,
    required: true,
    uppercase: true
  },
  semester: {
    type: Number,
    required: true,
    min: 1,
    max: 8
  },
  parentPhone: {
    type: String,
    required: true,
    validate: {
      validator: function(v) {
        return /^[\+]?[0-9]{10,15}$/.test(v.replace(/[\s\-\(\)]/g, ''));
      },
      message: "Please enter a valid phone number"
    }
  },
  
  // ✅ NEW: Language preference fields
  languageSubject: {
    type: String,
    uppercase: true,
    enum: ['KANNADA', 'HINDI', 'SANSKRIT', null],
    default: null
  },
  languageGroup: {
    type: String,
    uppercase: true,
    default: null // e.g., "BBA_SEM3_KANNADA", "BCA_SEM5_HINDI"
  },
  
  isActive: {
    type: Boolean,
    default: true
  },
  migrationGeneration: {
    type: Number,
    default: 0
  },
  originalSemester: {
    type: Number,
    required: true,
    default: function() { return this.semester; }
  },
  lastMigrationDate: {
    type: Date,
    default: null
  },
  migrationBatch: {
    type: String,
    default: null
  },
  addedToSemesterDate: {
    type: Date,
    default: Date.now
  },
  migrationHistory: [{
    fromSemester: Number,
    toSemester: Number,
    migratedDate: Date,
    migrationBatch: String,
    generation: Number
  }],
  academicYear: {
    type: String,
    default: () => new Date().getFullYear().toString()
  }
}, {
  timestamps: true,
  strict: false
});

// ✅ ENHANCED: Subject Schema with Language Support
const subjectSchema = new mongoose.Schema({
  subjectName: {
    type: String,
    required: true,
    trim: true,
    uppercase: true
  },
  stream: {
    type: String,
    required: true,
    uppercase: true
  },
  semester: {
    type: Number,
    required: true,
    min: 1,
    max: 8
  },
  credits: {
    type: Number,
    required: true,
    min: 1,
    max: 6,
    default: 4
  },
  subjectType: {
    type: String,
    required: true,
    uppercase: true,
    enum: ['CORE', 'ELECTIVE', 'LANGUAGE', 'OPTIONAL'],
    default: 'CORE'
  },
  
  // ✅ NEW: Language-specific fields
  isLanguageSubject: {
    type: Boolean,
    default: false
  },
  languageType: {
    type: String,
    uppercase: true,
    enum: ['KANNADA', 'HINDI', 'SANSKRIT', null],
    default: null
  },
  
  isActive: {
    type: Boolean,
    default: true
  },
  academicYear: {
    type: String,
    default: () => new Date().getFullYear().toString()
  }
}, {
  timestamps: true,
  strict: false
});

// ✅ ENHANCED: Attendance Schema with Language Group Support
const attendanceSchema = new mongoose.Schema({
  date: {
    type: Date,
    required: true
  },
  subject: {
    type: String,
    required: true
  },
  stream: {
    type: String,
    required: true,
    uppercase: true
  },
  semester: {
    type: Number,
    required: true
  },
  
  // ✅ NEW: Language group support
  isLanguageSubject: {
    type: Boolean,
    default: false
  },
  languageType: {
    type: String,
    uppercase: true,
    enum: ['KANNADA', 'HINDI', 'SANSKRIT', null],
    default: null
  },
  languageGroup: {
    type: String,
    uppercase: true,
    default: null
  },
  
  studentsPresent: {
    type: [String],
    default: []
  },
  totalStudents: {
    type: Number,
    default: 0
  },
  totalPossibleStudents: {
    type: Number,
    default: 0 // For language subjects, this is the count of students in that language group
  }
}, {
  timestamps: true
});

// ✅ ENHANCED: Message Log Schema
const messageLogSchema = new mongoose.Schema({
  date: {
    type: String,
    required: true
  },
  stream: {
    type: String,
    required: true,
    uppercase: true
  },
  semester: {
    type: Number,
    required: true
  },
  
  // ✅ NEW: Language group messaging support
  languageGroup: {
    type: String,
    uppercase: true,
    default: null
  },
  
  messagesSent: {
    type: Number,
    default: 0
  },
  messagesFailed: {
    type: Number,
    default: 0
  },
  totalStudentsNotified: {
    type: Number,
    default: 0
  },
  fullDayAbsentCount: {
    type: Number,
    default: 0
  },
  partialDayAbsentCount: {
    type: Number,
    default: 0
  },
  subjectsIncluded: [{
    type: String
  }],
  sentAt: {
    type: Date,
    default: Date.now
  },
  sentBy: {
    type: String,
    default: 'manual'
  },
  whatsappResults: [{
    studentID: String,
    studentName: String,
    success: Boolean,
    messageType: String,
    error: String,
    languageGroup: String
  }]
}, {
  timestamps: true
});

// ✅ FIXED: Complete Stream mappings including BCom Section B
const STREAM_MAPPINGS = {
  "BCA": "bca",
  "BBA": "bba", 
  "BCom": "bcom",
  "BCom Section B": "bcomsectionb",  // ✅ Separate stream
  "BCom-BDA": "bcom-bda",           // ✅ Fixed underscore
  "BCom A and F": "bcom_a_and_f"
};

// ✅ Collection name function with validation
function getCollectionName(stream, semester, type) {
  console.log(`🗂️ Input: stream="${stream}", semester="${semester}", type="${type}"`);
  
  if (!stream || !semester || !type) {
    throw new Error("Stream, semester, and type are required");
  }
  
  const streamCode = STREAM_MAPPINGS[stream];
  if (!streamCode) {
    throw new Error(`Unknown stream: ${stream}. Valid streams: ${Object.keys(STREAM_MAPPINGS).join(', ')}`);
  }
  
  const collectionName = `${streamCode}_sem${semester}_${type}`;
  console.log(`🗂️ Output: "${collectionName}"`);
  return collectionName;
}

// Enhanced Dynamic Model Loaders with caching
const modelCache = new Map();

// ✅ Enhanced Student Model with language support
function getStudentModel(stream, sem) {
  if (!stream || !sem) {
    throw new Error("Stream and semester are required");
  }
  
  const modelName = getCollectionName(stream, sem, "students");
  
  if (modelCache.has(modelName)) {
    return modelCache.get(modelName);
  }
  
  const model = mongoose.models[modelName] || mongoose.model(modelName, studentSchema, modelName);
  modelCache.set(modelName, model);
  
  console.log(`✅ Created student model for collection: ${modelName}`);
  return model;
}

// ✅ Enhanced Subject Model with language support
function getSubjectModel(stream, sem) {
  if (!stream || !sem) {
    throw new Error("Stream and semester are required");
  }
  
  const modelName = getCollectionName(stream, sem, "subjects");
  
  if (modelCache.has(modelName)) {
    return modelCache.get(modelName);
  }
  
  const model = mongoose.models[modelName] || mongoose.model(modelName, subjectSchema, modelName);
  modelCache.set(modelName, model);
  
  console.log(`✅ Created subject model for collection: ${modelName}`);
  return model;
}

// ✅ Enhanced Attendance Model with language support
function getAttendanceModel(stream, sem, subject) {
  if (!stream || !sem || !subject) {
    throw new Error("Stream, semester, and subject are required");
  }
  
  const streamCode = STREAM_MAPPINGS[stream];
  if (!streamCode) {
    throw new Error(`Unknown stream: ${stream}`);
  }
  
  const cleanSubject = subject.toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_]/g, '');
  const modelName = `${streamCode}_sem${sem}_${cleanSubject}_attendance`;
  
  if (modelCache.has(modelName)) {
    return modelCache.get(modelName);
  }
  
  const model = mongoose.models[modelName] || mongoose.model(modelName, attendanceSchema, modelName);
  modelCache.set(modelName, model);
  
  console.log(`✅ Created attendance model: ${modelName}`);
  return model;
}

// Message Log Model
function getMessageLogModel() {
  return mongoose.models.message_logs || mongoose.model('message_logs', messageLogSchema);
}

// ✅ Enhanced Input Validation Middleware
const validateParams = (req, res, next) => {
  const { stream, sem } = req.params;
  
  if (!stream || !sem) {
    return res.status(400).json({ 
      success: false,
      message: "Stream and semester are required" 
    });
  }
  
  if (isNaN(sem) || parseInt(sem) < 1 || parseInt(sem) > 8) {
    return res.status(400).json({ 
      success: false,
      message: "Invalid semester. Must be between 1-8" 
    });
  }
  
  // ✅ Complete stream validation
  const validStreams = Object.keys(STREAM_MAPPINGS);
  if (!validStreams.includes(stream)) {
    return res.status(400).json({
      success: false,
      message: `Invalid stream. Must be one of: ${validStreams.join(', ')}`
    });
  }
  
  next();
};

// ✅ Enhanced helper functions
const getActiveStudentQuery = () => ({
  $or: [
    { isActive: true },
    { isActive: { $exists: false } },
    { isActive: null }
  ]
});

// ✅ NEW: Helper to get students by language group
const getStudentsByLanguage = async (Student, languageType = null) => {
  if (languageType) {
    return await Student.find({
      ...getActiveStudentQuery(),
      languageSubject: languageType
    }).sort({ studentID: 1 });
  } else {
    return await Student.find(getActiveStudentQuery()).sort({ studentID: 1 });
  }
};

// ✅ NEW: Helper to get subjects by type
const getSubjectsByType = async (Subject, subjectType = null, languageType = null) => {
  let query = { isActive: { $ne: false } };
  
  if (subjectType) {
    query.subjectType = subjectType;
  }
  
  if (languageType) {
    query.languageType = languageType;
    query.isLanguageSubject = true;
  }
  
  return await Subject.find(query).sort({ subjectName: 1 });
};

// ✅ FIXED: Simple promotion system with BCom Section B support
router.post("/simple-promotion/:stream", async (req, res) => {
  const { stream } = req.params;
  
  // ✅ Updated stream validation
  const validStreams = ['BCA', 'BBA', 'BCom', 'BCom Section B', 'BCom-BDA', 'BCom A and F'];
  if (!stream || !validStreams.includes(stream)) {
    return res.status(400).json({
      success: false,
      message: `Invalid stream. Must be one of: ${validStreams.join(', ')}`
    });
  }
  
  try {
    console.log(`Starting simple promotion for ${stream.toUpperCase()}`);
    
    const promotionDate = new Date();
    const promotionBatch = `simple_promotion_${stream.replace(/\s+/g, '_')}_${Date.now()}`;
    let totalPromoted = 0;
    let totalGraduated = 0;
    const promotionDetails = [];
    
    // ✅ Handle BCom Section B (only semesters 5-6)
    let semesterRange;
    if (stream === 'BCom Section B') {
      semesterRange = [5, 6];
      console.log('📚 Processing BCom Section B - Limited to semesters 5-6');
    } else {
      semesterRange = [1, 2, 3, 4, 5, 6];
      console.log('📚 Processing regular stream - Full semester range 1-6');
    }
    
    // Start transaction for data consistency
    const session = await mongoose.startSession();
    
    try {
      await session.withTransaction(async () => {
        
        // Step 1: Handle graduation (6th semester students)
        if (semesterRange.includes(6)) {
          try {
            const Semester6Students = getStudentModel(stream, 6);
            const semester6Count = await Semester6Students.countDocuments().session(session);
            
            if (semester6Count > 0) {
              // Get student details before deletion for logging
              const graduatingStudents = await Semester6Students.find({}).session(session);
              
              // Delete 6th semester students (graduated)
              await Semester6Students.deleteMany({}).session(session);
              totalGraduated = semester6Count;
              
              console.log(`Graduated ${totalGraduated} students from Semester 6`);
              promotionDetails.push({
                action: 'graduation',
                semester: 6,
                count: totalGraduated,
                students: graduatingStudents.map(s => ({ id: s.studentID, name: s.name }))
              });
            }
          } catch (error) {
            console.error(`Error handling Semester 6 graduation:`, error);
            // Continue with other semesters even if 6th semester fails
          }
        }
        
        // Step 2: Promote students
        const promotionPairs = [];
        if (stream === 'BCom Section B') {
          // BCom Section B: only 5→6 promotion
          promotionPairs.push({ from: 5, to: 6 });
        } else {
          // Regular streams: 5→6, 4→5, 3→4, 2→3, 1→2
          for (let fromSem = 5; fromSem >= 1; fromSem--) {
            promotionPairs.push({ from: fromSem, to: fromSem + 1 });
          }
        }
        
        for (const { from: fromSem, to: toSem } of promotionPairs) {
          try {
            const SourceStudent = getStudentModel(stream, fromSem);
            const TargetStudent = getStudentModel(stream, toSem);
            
            // Get all active students in source semester
            const studentsToPromote = await SourceStudent.find(getActiveStudentQuery()).session(session);
            
            console.log(`Promoting ${stream} Semester ${fromSem}→${toSem}: ${studentsToPromote.length} students`);
            
            if (studentsToPromote.length > 0) {
              // Create students in target semester
              const promotedStudents = studentsToPromote.map(student => ({
                studentID: student.studentID,
                name: student.name,
                stream: student.stream,
                semester: toSem,
                parentPhone: student.parentPhone,
                isActive: true,
                migrationGeneration: (student.migrationGeneration || 0) + 1,
                originalSemester: student.originalSemester || fromSem,
                addedToSemesterDate: promotionDate,
                lastMigrationDate: promotionDate,
                migrationBatch: promotionBatch,
                migrationHistory: [
                  ...(student.migrationHistory || []),
                  {
                    fromSemester: fromSem,
                    toSemester: toSem,
                    migratedDate: promotionDate,
                    migrationBatch: promotionBatch,
                    generation: (student.migrationGeneration || 0) + 1
                  }
                ],
                academicYear: new Date().getFullYear().toString()
              }));
              
              // Insert all promoted students to target semester
              await TargetStudent.insertMany(promotedStudents, { session });
              
              // Remove students from source semester
              await SourceStudent.deleteMany({}).session(session);
              
              totalPromoted += studentsToPromote.length;
              
              promotionDetails.push({
                action: 'promotion',
                fromSemester: fromSem,
                toSemester: toSem,
                count: studentsToPromote.length,
                students: studentsToPromote.map(s => ({ id: s.studentID, name: s.name }))
              });
            }
          } catch (error) {
            console.error(`Error promoting from Semester ${fromSem} to ${toSem}:`, error);
            throw error; // Re-throw to abort transaction
          }
        }
        
      });
      
    } finally {
      await session.endSession();
    }
    
    console.log(`Simple promotion completed: ${totalPromoted} promoted, ${totalGraduated} graduated`);
    
    // ✅ Build promotion flow based on stream type
    let promotionFlow;
    if (stream === 'BCom Section B') {
      promotionFlow = [
        "Semester 5 → Semester 6",
        `Semester 6 → Graduated (${totalGraduated} students removed)`
      ];
    } else {
      promotionFlow = [
        "Semester 1 → Semester 2",
        "Semester 2 → Semester 3", 
        "Semester 3 → Semester 4",
        "Semester 4 → Semester 5",
        "Semester 5 → Semester 6",
        `Semester 6 → Graduated (${totalGraduated} students removed)`
      ];
    }
    
    res.json({
      success: true,
      message: `Simple Promotion Completed for ${stream.toUpperCase()}!`,
      stream: stream.toUpperCase(),
      streamType: stream === 'BCom Section B' ? 'Limited Stream (5-6)' : 'Full Stream (1-6)',
      promotionDate: promotionDate.toISOString(),
      promotionBatch: promotionBatch,
      totalPromoted: totalPromoted,
      totalGraduated: totalGraduated,
      promotionFlow: promotionFlow,
      promotionDetails: promotionDetails,
      note: stream === 'BCom Section B' 
        ? "BCom Section B students promoted. Only semester 5 is now empty for new admissions."
        : "All students moved up one semester. Semester 1 is now empty for new admissions."
    });
    
  } catch (error) {
    console.error("Error in simple promotion:", error);
    res.status(500).json({
      success: false,
      message: "Failed to execute simple promotion",
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// ✅ FIXED: Promotion preview with BCom Section B support
router.get("/simple-promotion-preview/:stream", async (req, res) => {
  const { stream } = req.params;
  
  // ✅ Updated stream validation
  const validStreams = ['BCA', 'BBA', 'BCom', 'BCom Section B', 'BCom-BDA', 'BCom A and F'];
  if (!stream || !validStreams.includes(stream)) {
    return res.status(400).json({
      success: false,
      message: `Invalid stream. Must be one of: ${validStreams.join(', ')}`
    });
  }
  
  try {
    const summary = {};
    let totalStudents = 0;
    const semesterDetails = [];
    
    // ✅ Determine semester range based on stream
    const semesterRange = stream === 'BCom Section B' ? [5, 6] : [1, 2, 3, 4, 5, 6];
    
    // Count students in each semester
    for (const sem of semesterRange) {
      try {
        const Student = getStudentModel(stream, sem);
        const count = await Student.countDocuments(getActiveStudentQuery());
        summary[`semester${sem}`] = count;
        totalStudents += count;
        
        let afterPromotion;
        if (sem === 6) {
          afterPromotion = 'Graduated';
        } else if (stream === 'BCom Section B' && sem === 5) {
          afterPromotion = summary[`semester${sem - 1}`] || 0; // Will be 0 since no sem 4 in Section B
        } else {
          afterPromotion = summary[`semester${sem - 1}`] || 0;
        }
        
        semesterDetails.push({
          semester: sem,
          currentCount: count,
          afterPromotion: afterPromotion
        });
      } catch (error) {
        console.error(`Error counting students in Semester ${sem}:`, error);
        summary[`semester${sem}`] = 0;
      }
    }
    
    // ✅ Build promotion preview based on stream type
    let promotionPreview;
    if (stream === 'BCom Section B') {
      promotionPreview = [
        `Semester 5 (${summary.semester5 || 0}) → Semester 6`,
        `Semester 6 (${summary.semester6 || 0}) → Will Graduate & Be Removed`
      ];
    } else {
      promotionPreview = [
        `Semester 1 (${summary.semester1 || 0}) → Semester 2`,
        `Semester 2 (${summary.semester2 || 0}) → Semester 3`,
        `Semester 3 (${summary.semester3 || 0}) → Semester 4`, 
        `Semester 4 (${summary.semester4 || 0}) → Semester 5`,
        `Semester 5 (${summary.semester5 || 0}) → Semester 6`,
        `Semester 6 (${summary.semester6 || 0}) → Will Graduate & Be Removed`
      ];
    }
    
    res.json({
      success: true,
      stream: stream.toUpperCase(),
      streamType: stream === 'BCom Section B' ? 'Limited Stream (5-6)' : 'Full Stream (1-6)',
      totalStudents: totalStudents,
      semesterBreakdown: summary,
      semesterDetails: semesterDetails,
      promotionPreview: promotionPreview,
      warnings: [
        (summary.semester6 || 0) > 0 ? `${summary.semester6} students will graduate and be permanently removed` : null,
        totalStudents === 0 ? 'No students found in this stream' : null
      ].filter(Boolean),
      note: stream === 'BCom Section B' 
        ? "BCom Section B promotion affects only semesters 5-6"
        : "Simple promotion moves ALL students up one semester"
    });
    
  } catch (error) {
    console.error("Error getting simple promotion preview:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get promotion preview",
      error: error.message
    });
  }
});

// ✅ FIXED: Promotion history with BCom Section B support
router.get("/promotion-history/:stream", async (req, res) => {
  const { stream } = req.params;
  const { page = 1, limit = 10 } = req.query;
  
  // ✅ Updated stream validation
  const validStreams = ['BCA', 'BBA', 'BCom', 'BCom Section B', 'BCom-BDA', 'BCom A and F'];
  if (!stream || !validStreams.includes(stream)) {
    return res.status(400).json({
      success: false,
      message: `Invalid stream. Must be one of: ${validStreams.join(', ')}`
    });
  }
  
  try {
    // This would require a separate promotion history collection
    // For now, return a placeholder response
    res.json({
      success: true,
      message: "Promotion history endpoint ready",
      stream: stream.toUpperCase(),
      streamType: stream === 'BCom Section B' ? 'Limited Stream (5-6)' : 'Full Stream (1-6)',
      note: "History tracking will be implemented with a separate collection",
      plannedFeatures: [
        "Promotion batch tracking",
        "Student migration history",
        "Rollback capabilities",
        "Detailed promotion logs"
      ]
    });
    
  } catch (error) {
    console.error("Error getting promotion history:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get promotion history",
      error: error.message
    });
  }
});

// ✅ BONUS: Get stream info route
router.get("/stream-info/:stream", async (req, res) => {
  const { stream } = req.params;
  
  try {
    const validStreams = ['BCA', 'BBA', 'BCom', 'BCom Section B', 'BCom-BDA', 'BCom A and F'];
    if (!validStreams.includes(stream)) {
      return res.status(400).json({
        success: false,
        message: `Invalid stream. Must be one of: ${validStreams.join(', ')}`
      });
    }
    
    const semesterRange = stream === 'BCom Section B' ? [5, 6] : [1, 2, 3, 4, 5, 6];
    const collectionNames = [];
    const studentCounts = {};
    
    for (const sem of semesterRange) {
      try {
        const Student = getStudentModel(stream, sem);
        collectionNames.push(Student.collection.name);
        const count = await Student.countDocuments(getActiveStudentQuery());
        studentCounts[`semester${sem}`] = count;
      } catch (error) {
        console.error(`Error accessing semester ${sem}:`, error);
        studentCounts[`semester${sem}`] = 0;
      }
    }
    
    res.json({
      success: true,
      stream: stream,
      streamType: stream === 'BCom Section B' ? 'Limited Stream' : 'Full Stream',
      availableSemesters: semesterRange,
      collections: collectionNames,
      studentCounts: studentCounts,
      totalStudents: Object.values(studentCounts).reduce((sum, count) => sum + count, 0)
    });
    
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to get stream info",
      error: error.message
    });
  }
});

// ✅ ADD SINGLE STUDENT Route
router.post("/add-student/:stream/sem:sem", validateParams, async (req, res) => {
  const { stream, sem } = req.params;
  const { studentID, name, parentPhone } = req.body;
  
  // Validation
  if (!studentID || !name || !parentPhone) {
    return res.status(400).json({ 
      success: false,
      message: "All fields are required: studentID, name, parentPhone" 
    });
  }
  
  // Phone validation
  const phoneRegex = /^[\+]?[0-9]{10,15}$/;
  if (!phoneRegex.test(parentPhone.replace(/[\s\-\(\)]/g, ''))) {
    return res.status(400).json({ 
      success: false,
      message: "Please enter a valid phone number (10-15 digits)" 
    });
  }
  
  try {
    const Student = getStudentModel(stream, sem);
    
    // Check if student already exists
    const existingStudent = await Student.findOne({ studentID });
    if (existingStudent) {
      return res.status(409).json({ 
        success: false,
        message: "Student ID already exists in this semester" 
      });
    }
    
    // Create new student
    const newStudent = new Student({
      studentID: studentID.trim().toUpperCase(),
      name: name.trim(),
      stream: stream.toUpperCase(),
      semester: parseInt(sem),
      parentPhone: parentPhone.trim(),
      isActive: true,
      migrationGeneration: 0,
      originalSemester: parseInt(sem),
      addedToSemesterDate: new Date(),
      academicYear: new Date().getFullYear().toString()
    });
    
    await newStudent.save();
    
    console.log(`✅ Student added: ${studentID} to ${stream} Semester ${sem}`);
    
    res.status(201).json({
      success: true,
      message: "✅ Student added successfully",
      student: {
        studentID: newStudent.studentID,
        name: newStudent.name,
        stream: newStudent.stream,
        semester: newStudent.semester,
        migrationGeneration: newStudent.migrationGeneration,
        originalSemester: newStudent.originalSemester,
        addedDate: newStudent.addedToSemesterDate
      }
    });
    
  } catch (error) {
    console.error("❌ Error adding student:", error);
    
    // Handle duplicate key error
    if (error.code === 11000) {
      return res.status(409).json({ 
        success: false,
        message: "Student ID already exists" 
      });
    }
    
    res.status(500).json({ 
      success: false,
      message: "Failed to add student",
      error: error.message 
    });
  }
});

// ✅ BULK UPLOAD STUDENTS Route
router.post("/bulk-upload-students/:stream/sem:sem", validateParams, async (req, res) => {
  const { stream, sem } = req.params;
  const { students } = req.body;
  
  if (!students || !Array.isArray(students) || students.length === 0) {
    return res.status(400).json({ 
      success: false,
      message: "Students array is required and must not be empty" 
    });
  }
  
  try {
    const Student = getStudentModel(stream, sem);
    const results = [];
    let addedCount = 0;
    let failedCount = 0;
    
    console.log(`📚 Starting bulk upload: ${students.length} students to ${stream} Semester ${sem}`);
    
    for (const studentData of students) {
      const { studentID, name, parentPhone } = studentData;
      
      // Validation for each student
      if (!studentID || !name || !parentPhone) {
        results.push({
          studentID: studentID || 'UNKNOWN',
          name: name || 'UNKNOWN', 
          success: false,
          error: "Missing required fields: studentID, name, parentPhone"
        });
        failedCount++;
        continue;
      }
      
      // Phone validation
      const phoneRegex = /^[\+]?[0-9]{10,15}$/;
      if (!phoneRegex.test(parentPhone.replace(/[\s\-\(\)]/g, ''))) {
        results.push({
          studentID,
          name,
          success: false,
          error: "Invalid phone number format"
        });
        failedCount++;
        continue;
      }
      
      try {
        // Check if student already exists
        const existingStudent = await Student.findOne({ studentID });
        if (existingStudent) {
          results.push({
            studentID,
            name,
            success: false,
            error: "Student ID already exists"
          });
          failedCount++;
          continue;
        }
        
        // Create new student
        const newStudent = new Student({
          studentID: studentID.trim().toUpperCase(),
          name: name.trim(),
          stream: stream.toUpperCase(),
          semester: parseInt(sem),
          parentPhone: parentPhone.trim(),
          isActive: true,
          migrationGeneration: 0,
          originalSemester: parseInt(sem),
          addedToSemesterDate: new Date(),
          academicYear: new Date().getFullYear().toString()
        });
        
        await newStudent.save();
        addedCount++;
        
        results.push({
          studentID,
          name,
          success: true,
          message: "Student added successfully"
        });
        
      } catch (error) {
        results.push({
          studentID,
          name,
          success: false,
          error: error.message
        });
        failedCount++;
      }
    }
    
    console.log(`✅ Bulk upload completed: ${addedCount}/${students.length} students added to ${stream} Semester ${sem}`);
    
    res.status(200).json({
      success: true,
      message: `✅ Bulk upload completed: ${addedCount}/${students.length} students added`,
      stream: stream.toUpperCase(),
      semester: parseInt(sem),
      total: students.length,
      added: addedCount,
      failed: failedCount,
      results: results
    });
    
  } catch (error) {
    console.error("❌ Error in bulk upload:", error);
    res.status(500).json({ 
      success: false,
      message: "Failed to bulk upload students",
      error: error.message 
    });
  }
});

// ✅ SETUP SUBJECTS Route
router.post("/setup-subjects/:stream/sem:sem", validateParams, async (req, res) => {
  const { stream, sem } = req.params;
  const { subjects } = req.body;
  
  if (!subjects || !Array.isArray(subjects) || subjects.length === 0) {
    return res.status(400).json({ 
      success: false,
      message: "Subjects array is required and must not be empty" 
    });
  }
  
  try {
    const Subject = getSubjectModel(stream, sem);
    const results = [];
    let addedCount = 0;
    
    for (const subjectName of subjects) {
      if (!subjectName || subjectName.trim().length < 2) {
        results.push({
          subjectName: subjectName,
          success: false,
          error: "Subject name must be at least 2 characters long"
        });
        continue;
      }
      
      try {
        // Check if subject already exists
        const existingSubject = await Subject.findOne({ 
          subjectName: subjectName.trim() 
        });
        
        if (existingSubject) {
          results.push({
            subjectName: subjectName.trim(),
            success: false,
            error: "Subject already exists"
          });
          continue;
        }
        
        // Create new subject
        const newSubject = new Subject({
          subjectName: subjectName.trim(),
          stream: stream.toUpperCase(),
          semester: parseInt(sem)
        });
        
        await newSubject.save();
        addedCount++;
        
        results.push({
          subjectName: subjectName.trim(),
          success: true,
          message: "Subject added successfully"
        });
        
      } catch (error) {
        results.push({
          subjectName: subjectName.trim(),
          success: false,
          error: error.message
        });
      }
    }
    
    console.log(`✅ Subjects setup completed: ${addedCount}/${subjects.length} added for ${stream} Semester ${sem}`);
    
    res.status(200).json({
      success: true,
      message: `✅ Subjects setup completed: ${addedCount}/${subjects.length} subjects added`,
      stream: stream.toUpperCase(),
      semester: parseInt(sem),
      total: subjects.length,
      added: addedCount,
      failed: subjects.length - addedCount,
      results: results
    });
    
  } catch (error) {
    console.error("❌ Error setting up subjects:", error);
    res.status(500).json({ 
      success: false,
      message: "Failed to setup subjects",
      error: error.message 
    });
  }
});

// ✅ Check if attendance already exists for the same subject and date
router.get("/check-attendance/:stream/sem:sem/:subject", validateParams, async (req, res) => {
  const { stream, sem, subject } = req.params;
  const { date } = req.query;

  if (!date) {
    return res.status(400).json({ 
      exists: false, 
      message: "Date parameter is required" 
    });
  }

  try {
    const Attendance = getAttendanceModel(stream, sem, subject);
    const existingRecord = await Attendance.findOne({
      date: new Date(date),
      subject: subject
    });

    res.json({
      exists: !!existingRecord,
      date: date,
      subject: subject,
      stream: stream,
      semester: sem,
      recordId: existingRecord?._id || null,
      studentsPresent: existingRecord?.studentsPresent || [],
      recordCount: existingRecord ? 1 : 0
    });

  } catch (error) {
    console.error("❌ Error checking attendance:", error);
    res.status(500).json({ 
      exists: false, 
      message: "Failed to check attendance" 
    });
  }
});
// ✅ FIXED: GET Students Route with Language Fields
router.get("/students/:stream/sem:sem", validateParams, async (req, res) => {
  const { stream, sem } = req.params;
  
  try {
    console.log(`👥 Loading students for: ${stream} Semester ${sem}`);
    
    const Student = getStudentModel(stream, sem);
    const query = getActiveStudentQuery();
    
    const students = await Student.find(query)
      .select('studentID name parentPhone stream semester migrationGeneration originalSemester languageSubject languageGroup') // ✅ Added language fields
      .sort({ studentID: 1 });
    
    // ✅ Group students by language for better organization
    const studentsByLanguage = students.reduce((acc, student) => {
      const lang = student.languageSubject || 'NO_LANGUAGE';
      if (!acc[lang]) acc[lang] = [];
      acc[lang].push(student);
      return acc;
    }, {});
    
    console.log(`✅ Found ${students.length} students in collection: ${Student.collection.name}`);
    
    res.json({
      success: true,
      count: students.length,
      stream: stream,
      semester: parseInt(sem),
      students: students,
      studentsByLanguage: studentsByLanguage, // ✅ Grouped by language
      languageBreakdown: Object.keys(studentsByLanguage).map(lang => ({
        language: lang,
        count: studentsByLanguage[lang].length,
        students: studentsByLanguage[lang].map(s => ({ id: s.studentID, name: s.name }))
      })),
      collectionUsed: Student.collection.name
    });
    
  } catch (error) {
    console.error(`❌ Error fetching students:`, error);
    res.status(500).json({ 
      success: false,
      message: "Failed to fetch students",
      error: error.message,
      stream: stream,
      semester: sem
    });
  }
});

// ✅ FIXED: GET Subjects Route with Language Fields
router.get("/subjects/:stream/sem:sem", validateParams, async (req, res) => {
  const { stream, sem } = req.params;
  
  try {
    console.log(`📚 Loading subjects for: ${stream} Semester ${sem}`);
    
    const Subject = getSubjectModel(stream, sem);
    const query = { isActive: { $ne: false } };
    
    const subjects = await Subject.find(query)
      .select('subjectName stream semester isActive subjectType isLanguageSubject languageType credits') // ✅ Added language fields
      .sort({ subjectName: 1 });
    
    // ✅ Separate core and language subjects
    const coreSubjects = subjects.filter(s => !s.isLanguageSubject);
    const languageSubjects = subjects.filter(s => s.isLanguageSubject);
    
    console.log(`✅ Found ${subjects.length} subjects in collection: ${Subject.collection.name}`);
    console.log(`   Core: ${coreSubjects.length}, Language: ${languageSubjects.length}`);
    
    res.json({
      success: true,
      count: subjects.length,
      stream: stream,
      semester: parseInt(sem),
      subjects: subjects,
      subjectsByType: {
        core: coreSubjects.map(s => ({
          name: s.subjectName,
          type: s.subjectType,
          credits: s.credits,
          attendanceType: 'ALL_STUDENTS'
        })),
        language: languageSubjects.map(s => ({
          name: s.subjectName,
          type: s.subjectType,
          languageType: s.languageType,
          credits: s.credits,
          attendanceType: 'LANGUAGE_FILTERED'
        }))
      },
      attendanceInfo: {
        coreSubjects: "All students attend together",
        languageSubjects: "Students filtered by language choice"
      },
      collectionUsed: Subject.collection.name
    });
    
  } catch (error) {
    console.error(`❌ Error fetching subjects:`, error);
    res.status(500).json({ 
      success: false,
      message: "Failed to fetch subjects",
      error: error.message,
      stream: stream,
      semester: sem
    });
  }
});

// ✅ FIXED: POST Mark Attendance with Language Subject Filtering
router.post("/attendance/:stream/sem:sem/:subject", validateParams, async (req, res) => {
  const { stream, sem, subject } = req.params;
  const { date, studentsPresent, forceOverwrite } = req.body;

  if (!date || !subject || !Array.isArray(studentsPresent)) {
    return res.status(400).json({ 
      success: false,
      message: "Missing required fields: date, subject, studentsPresent (array)" 
    });
  }

  try {
    console.log(`📝 Marking attendance for: ${stream} Sem ${sem} - ${subject} on ${date}`);
    
    const Attendance = getAttendanceModel(stream, sem, subject);
    const Student = getStudentModel(stream, sem);
    const Subject = getSubjectModel(stream, sem);
    
    // ✅ Get subject details to determine filtering
    const subjectDoc = await Subject.findOne({ 
      subjectName: subject.toUpperCase(),
      isActive: { $ne: false }
    });
    
    if (!subjectDoc) {
      return res.status(404).json({
        success: false,
        message: `Subject "${subject}" not found in ${stream} Semester ${sem}`
      });
    }
    
    // ✅ KEY FIX: Filter students based on subject type
    let relevantStudents;
    let attendanceScope;
    
    if (subjectDoc.isLanguageSubject && subjectDoc.languageType) {
      // Language Subject: Only get students who chose this language
      relevantStudents = await Student.find({
        ...getActiveStudentQuery(),
        languageSubject: subjectDoc.languageType
      }, "studentID name parentPhone languageSubject languageGroup");
      
      attendanceScope = {
        type: 'LANGUAGE_FILTERED',
        language: subjectDoc.languageType,
        note: `Only ${subjectDoc.languageType} students`
      };
      
      console.log(`🔤 Language subject: Found ${relevantStudents.length} ${subjectDoc.languageType} students`);
      
    } else {
      // Core Subject: Get all students
      relevantStudents = await Student.find(
        getActiveStudentQuery(), 
        "studentID name parentPhone languageSubject languageGroup"
      );
      
      attendanceScope = {
        type: 'ALL_STUDENTS',
        language: null,
        note: 'All students attend together'
      };
      
      console.log(`📚 Core subject: Found ${relevantStudents.length} total students`);
    }

    const totalRelevantStudents = relevantStudents.length;

    if (totalRelevantStudents === 0) {
      return res.status(404).json({ 
        success: false,
        message: subjectDoc.isLanguageSubject ? 
          `No students found who chose ${subjectDoc.languageType}` :
          "No students found for this stream and semester"
      });
    }

    // ✅ Check for existing record
    if (!forceOverwrite) {
      const existingRecord = await Attendance.findOne({
        date: new Date(date),
        subject: subject
      });

      if (existingRecord) {
        return res.status(409).json({
          success: false,
          exists: true,
          message: "Attendance already taken for this subject and date",
          date: date,
          subject: subject,
          stream: stream,
          semester: sem,
          attendanceScope,
          existingData: {
            studentsPresent: existingRecord.studentsPresent,
            recordId: existingRecord._id,
            createdAt: existingRecord.createdAt
          }
        });
      }
    }

    // ✅ Validate that all present students are in the relevant student list
    const relevantStudentIDs = relevantStudents.map(s => s.studentID);
    const invalidStudents = studentsPresent.filter(id => !relevantStudentIDs.includes(id));
    
    if (invalidStudents.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Invalid students for this ${subjectDoc.isLanguageSubject ? 'language ' : ''}subject`,
        invalidStudents,
        attendanceScope,
        hint: subjectDoc.isLanguageSubject ? 
          `Only ${subjectDoc.languageType} students can attend this subject` :
          "Only enrolled students can be marked present"
      });
    }
    
    const existingRecord = await Attendance.findOne({
      date: new Date(date),
      subject: subject
    });
    const isOverwrite = !!existingRecord;

    // ✅ Store attendance in database with language info
    const attendanceData = {
      date: new Date(date),
      subject: subject,
      stream: stream.toUpperCase(),
      semester: parseInt(sem),
      studentsPresent: studentsPresent,
      totalStudents: totalRelevantStudents,
      isLanguageSubject: subjectDoc.isLanguageSubject,
      languageType: subjectDoc.languageType || null,
      languageGroup: subjectDoc.isLanguageSubject ? 
        `${stream.toUpperCase()}_SEM${sem}_${subjectDoc.languageType}` : null
    };
    
    const record = await Attendance.findOneAndUpdate(
      { 
        date: new Date(date), 
        subject: subject 
      },
      { $set: attendanceData },
      { upsert: true, new: true }
    );

    // ✅ Update base attendance collection
    await BaseAttendance.findOneAndUpdate(
      {
        date: new Date(date).toISOString().slice(0, 10),
        stream: stream.toUpperCase(),
        semester: Number(sem),
        subject: subject,
      },
      {
        $set: {
          studentsPresent: studentsPresent,
          studentsTotal: totalRelevantStudents,
          isLanguageSubject: subjectDoc.isLanguageSubject,
          languageType: subjectDoc.languageType || null
        },
      },
      { upsert: true, new: true }
    );

    // ✅ Calculate absent students from relevant student pool
    const absentStudents = relevantStudents.filter(
      student => !studentsPresent.includes(student.studentID)
    );

    const absentWithPhone = absentStudents.filter(s => s.parentPhone).length;
    const absentWithoutPhone = absentStudents.filter(s => !s.parentPhone).length;

    console.log(`✅ Attendance ${isOverwrite ? 'updated' : 'marked'} for ${stream} Semester ${sem} - ${subject} on ${date}`);
    console.log(`   Attendance Scope: ${attendanceScope.note}`);
    console.log(`   Relevant Students: ${totalRelevantStudents}`);
    console.log(`   Present: ${studentsPresent.length}, Absent: ${absentStudents.length}`);
    console.log(`   Absent with phone: ${absentWithPhone}, Absent without phone: ${absentWithoutPhone}`);

    res.status(200).json({ 
      success: true,
      message: `✅ Attendance ${isOverwrite ? 'updated' : 'marked'} successfully for ${subjectDoc.isLanguageSubject ? 'language ' : ''}subject. Use manual messaging system to send WhatsApp notifications.`, 
      data: record,
      isOverwrite,
      subject: {
        name: subjectDoc.subjectName,
        type: subjectDoc.subjectType,
        isLanguageSubject: subjectDoc.isLanguageSubject,
        languageType: subjectDoc.languageType,
        credits: subjectDoc.credits
      },
      attendanceScope,
      summary: {
        totalRelevantStudents: totalRelevantStudents,
        presentStudents: studentsPresent.length,
        absentStudents: absentStudents.length,
        absentWithPhone: absentWithPhone,
        absentWithoutPhone: absentWithoutPhone,
        attendancePercentage: ((studentsPresent.length / totalRelevantStudents) * 100).toFixed(1),
        // ✅ List of absent students for immediate feedback
        absentStudentsList: absentStudents.map(s => ({
          studentID: s.studentID,
          name: s.name,
          hasPhone: !!s.parentPhone,
          parentPhone: s.parentPhone ? 'Available' : 'Not Available',
          languageSubject: s.languageSubject || null
        }))
      },
      // ✅ Manual messaging info with language context
      manualMessaging: {
        enabled: true,
        note: `Attendance data stored for ${attendanceScope.note.toLowerCase()}. Use manual messaging system to send consolidated WhatsApp messages.`,
        nextSteps: [
          "Go to Manual Messaging System",
          `Select ${stream} - Semester ${sem}`,
          subjectDoc.isLanguageSubject ? `Filter by ${subjectDoc.languageType} students` : "Include all students",
          `Set date to ${new Date(date).toLocaleDateString('en-IN')}`,
          "Click 'Send Messages Now' when ready"
        ]
      }
    });

  } catch (error) {
    console.error("❌ Error marking attendance:", error);
    res.status(500).json({ 
      success: false,
      message: "Failed to mark attendance",
      error: error.message 
    });
  }
});
// ✅ FIXED: Enhanced attendance marking with proper language subject handling
router.post("/attendance/:stream/sem:sem/:subject", validateParams, async (req, res) => {
  const { stream, sem, subject } = req.params;
  const { date, studentsPresent, forceOverwrite } = req.body;

  try {
    const Student = getStudentModel(stream, sem);
    const Subject = getSubjectModel(stream, sem);
    const Attendance = getAttendanceModel(stream, sem, subject);
    
    // ✅ KEY FIX: Get subject details and filter students properly
    const subjectDoc = await Subject.findOne({ 
      subjectName: subject.toUpperCase(),
      isActive: { $ne: false }
    });
    
    if (!subjectDoc) {
      return res.status(404).json({
        success: false,
        message: `Subject "${subject}" not found`
      });
    }
    
    // ✅ Get the correct student list (filtered for language subjects)
    let relevantStudents;
    if (subjectDoc.isLanguageSubject && subjectDoc.languageType) {
      relevantStudents = await Student.find({
        ...getActiveStudentQuery(),
        languageSubject: subjectDoc.languageType
      }, "studentID name");
    } else {
      relevantStudents = await Student.find(getActiveStudentQuery(), "studentID name");
    }
    
    // ✅ Ensure all present students are from the correct filtered list
    const validStudentIDs = relevantStudents.map(s => s.studentID);
    const validPresentStudents = studentsPresent.filter(id => validStudentIDs.includes(id));
    
    // ✅ Save attendance with proper language metadata
    const attendanceData = {
      date: new Date(date),
      subject: subject.toUpperCase(),
      stream: stream.toUpperCase(),
      semester: parseInt(sem),
      studentsPresent: validPresentStudents,
      totalStudents: relevantStudents.length,
      
      // ✅ KEY: Add language metadata for proper retrieval
      isLanguageSubject: subjectDoc.isLanguageSubject || false,
      languageType: subjectDoc.languageType || null,
      languageGroup: subjectDoc.isLanguageSubject ? 
        `${stream.toUpperCase()}_SEM${sem}_${subjectDoc.languageType}` : null,
      
      // ✅ Add student list for verification
      eligibleStudents: validStudentIDs,
      subjectMetadata: {
        subjectType: subjectDoc.subjectType,
        credits: subjectDoc.credits
      }
    };
    
    const record = await Attendance.findOneAndUpdate(
      { date: new Date(date), subject: subject.toUpperCase() },
      { $set: attendanceData },
      { upsert: true, new: true }
    );
    
    console.log(`✅ Saved attendance for ${subject}:`);
    console.log(`   Language Subject: ${subjectDoc.isLanguageSubject}`);
    console.log(`   Language Type: ${subjectDoc.languageType || 'N/A'}`);
    console.log(`   Students Present: ${validPresentStudents.length}/${relevantStudents.length}`);
    console.log(`   Present IDs: ${validPresentStudents.join(', ')}`);
    
    res.status(200).json({
      success: true,
      message: "Attendance saved successfully",
      data: record,
      summary: {
        totalRelevantStudents: relevantStudents.length,
        presentStudents: validPresentStudents.length,
        absentStudents: relevantStudents.length - validPresentStudents.length,
        languageFiltered: subjectDoc.isLanguageSubject,
        languageType: subjectDoc.languageType
      }
    });
    
  } catch (error) {
    console.error("❌ Error saving attendance:", error);
    res.status(500).json({ 
      success: false, 
      message: "Failed to save attendance",
      error: error.message 
    });
  }
});

// ✅ ENHANCED: Manual Send Consolidated WhatsApp Messages (with duplicate prevention)
router.post("/send-absence-messages/:stream/sem:sem/:date", validateParams, async (req, res) => {
  const { stream, sem, date } = req.params;
  const { forceResend = false } = req.body;
  
  try {
    console.log(`📱 Manual messaging triggered for ${stream} Semester ${sem} on ${date}`);
    
    const Student = getStudentModel(stream, sem);
    const Subject = getSubjectModel(stream, sem);
    const MessageLog = getMessageLogModel();
    
    const dateKey = new Date(date).toISOString().slice(0, 10);
    
    // ✅ Enhanced duplicate prevention check
    if (!forceResend) {
      const existingLog = await MessageLog.findOne({
        date: dateKey,
        stream: stream.toUpperCase(),
        semester: parseInt(sem)
      });
      
      if (existingLog && existingLog.messagesSent > 0) {
        const formatDate = new Date(date).toLocaleDateString('en-IN', {
          day: '2-digit',
          month: '2-digit', 
          year: 'numeric'
        });
        
        return res.status(200).json({
          success: true,
          alreadySent: true,
          message: `📱 Messages already sent for ${stream} Semester ${sem} on ${formatDate}`,
          previousSendInfo: {
            date: formatDate,
            stream: stream.toUpperCase(),
            semester: sem,
            messagesSent: existingLog.messagesSent,
            messagesFailed: existingLog.messagesFailed,
            totalStudentsNotified: existingLog.totalStudentsNotified,
            sentAt: existingLog.sentAt,
            subjectsIncluded: existingLog.subjectsIncluded,
            sentBy: existingLog.sentBy,
            lastSentAgo: Math.floor((Date.now() - new Date(existingLog.sentAt).getTime()) / (1000 * 60)) + ' minutes ago'
          },
          note: "Messages already sent. Use 'forceResend: true' to send again.",
          actions: {
            viewHistory: `/api/message-history/${stream}/sem${sem}`,
            forceSend: `/api/force-resend-messages/${stream}/sem${sem}/${date}`,
            viewSummary: `/api/daily-absence-summary/${stream}/sem${sem}/${date}`
          }
        });
      }
    }
    
    // ✅ Parallel data fetching for better performance
    const [allStudents, allSubjects] = await Promise.all([
      Student.find(getActiveStudentQuery(), "studentID name parentPhone").lean(),
      Subject.find({}, "subjectName").lean()
    ]);
    
    if (allStudents.length === 0 || allSubjects.length === 0) {
      return res.status(404).json({ 
        success: false,
        message: "No students or subjects found for this stream and semester",
        details: {
          studentsFound: allStudents.length,
          subjectsFound: allSubjects.length
        }
      });
    }
    
    // ✅ Optimized attendance record fetching
    const attendancePromises = allSubjects.map(async (subject) => {
      try {
        const Attendance = getAttendanceModel(stream, sem, subject.subjectName);
        const record = await Attendance.findOne(
          { date: new Date(date) },
          { studentsPresent: 1 }
        ).lean();
        
        return {
          subject: subject.subjectName,
          studentsPresent: record ? record.studentsPresent : [],
          hasAttendance: !!record
        };
      } catch (error) {
        console.warn(`⚠️ Error fetching attendance for ${subject.subjectName}:`, error.message);
        return {
          subject: subject.subjectName,
          studentsPresent: [],
          hasAttendance: false,
          error: error.message
        };
      }
    });
    
    const allAttendanceRecords = await Promise.all(attendancePromises);
    const subjectsWithAttendance = allAttendanceRecords.filter(r => r.hasAttendance);
    
    if (subjectsWithAttendance.length === 0) {
      return res.status(400).json({
        success: false,
        message: `No attendance records found for ${date}. Please mark attendance first.`,
        suggestion: "Mark attendance for at least one subject before sending messages",
        availableSubjects: allSubjects.map(s => s.subjectName)
      });
    }
    
    // ✅ Enhanced absence calculation with better performance
    const studentsToNotify = [];
    const presentStudentsSet = new Set();
    
    // Create a map for faster lookups
    const attendanceMap = new Map(
      subjectsWithAttendance.map(record => [record.subject, new Set(record.studentsPresent)])
    );
    
    allStudents.forEach(student => {
      const absentSubjects = [];
      let presentSubjectCount = 0;
      
      subjectsWithAttendance.forEach(record => {
        if (attendanceMap.get(record.subject).has(student.studentID)) {
          presentSubjectCount++;
          presentStudentsSet.add(student.studentID);
        } else {
          absentSubjects.push(record.subject);
        }
      });
      
      if (absentSubjects.length > 0 && student.parentPhone) {
        const isFullDayAbsent = absentSubjects.length === subjectsWithAttendance.length;
        
        studentsToNotify.push({
          student: student,
          absentSubjects: absentSubjects,
          presentSubjects: presentSubjectCount,
          isFullDayAbsent: isFullDayAbsent,
          messageType: isFullDayAbsent ? 'full_day' : 'partial_day'
        });
      }
    });
    
    if (studentsToNotify.length === 0) {
      // ✅ Enhanced logging for no messages scenario
      await MessageLog.findOneAndUpdate(
        {
          date: dateKey,
          stream: stream.toUpperCase(),
          semester: parseInt(sem)
        },
        {
          messagesSent: 0,
          messagesFailed: 0,
          totalStudentsNotified: 0,
          fullDayAbsentCount: 0,
          partialDayAbsentCount: 0,
          subjectsIncluded: subjectsWithAttendance.map(s => s.subject),
          sentAt: new Date(),
          sentBy: forceResend ? 'manual-force' : 'manual',
          reason: 'no_absentees',
          summary: 'All students were present for all subjects'
        },
        { upsert: true, new: true }
      );
      
      return res.status(200).json({
        success: true,
        message: `🎉 Excellent! No students with absences found for ${date}. All students were present!`,
        summary: {
          totalStudents: allStudents.length,
          subjectsWithAttendance: subjectsWithAttendance.length,
          studentsToNotify: 0,
          messagesSent: 0,
          presentStudents: presentStudentsSet.size,
          attendanceRate: ((presentStudentsSet.size / allStudents.length) * 100).toFixed(1) + '%'
        }
      });
    }
    
    // ✅ Enhanced message sending with better error handling
    const whatsappResults = [];
    const formatDate = new Date(date).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: '2-digit', 
      year: 'numeric'
    });
    
    console.log(`📱 Sending messages to ${studentsToNotify.length} students`);
    
    // ✅ Process messages in smaller batches to avoid overwhelming the API
    const BATCH_SIZE = 5;
    const batches = [];
    
    for (let i = 0; i < studentsToNotify.length; i += BATCH_SIZE) {
      batches.push(studentsToNotify.slice(i, i + BATCH_SIZE));
    }
    
    let totalProcessed = 0;
    
    for (const batch of batches) {
      const batchPromises = batch.map(async (notificationData) => {
        const { student, absentSubjects, isFullDayAbsent } = notificationData;
        
        try {
          let message;
          
          if (isFullDayAbsent) {
            message = `🚨 *FULL DAY ABSENCE ALERT*

Dear Parent/Guardian,

Your child *${student.name}* (ID: ${student.studentID}) was *ABSENT FOR THE ENTIRE DAY* on ${formatDate}.

📚 *Academic Details:*
• Stream: ${stream.toUpperCase()}
• Semester: ${sem}
• Total Classes Missed: ${absentSubjects.length}

📞 Please contact the school office immediately if:
• Your child was present but not marked
• There was a valid reason for absence
• You need to discuss makeup arrangements

🏫 *MLA Academy of Higher Learning*
Smart Attendance System`;
          } else {
            message = `⚠️ *PARTIAL ABSENCE ALERT*

Dear Parent/Guardian,

Your child *${student.name}* (ID: ${student.studentID}) was *ABSENT* for specific classes on ${formatDate}.

📚 *Missing Classes:*
${absentSubjects.map((subj, index) => `${index + 1}. ${subj}`).join('\n')}

📊 *Details:*
• Stream: ${stream.toUpperCase()}
• Semester: ${sem}
• Classes Missed: ${absentSubjects.length} of ${absentSubjects.length + notificationData.presentSubjects}

📞 Please contact school if this information is incorrect.

🏫 *MLA Academy of Higher Learning*
Smart Attendance System`;
          }

          const result = await sendWhatsAppMessage(student.parentPhone, message);
          
          return {
            studentID: student.studentID,
            studentName: student.name,
            parentPhone: student.parentPhone,
            success: result.success,
            messageId: result.messageId || null,
            error: result.error || null,
            messageType: isFullDayAbsent ? 'full_day' : 'partial_day',
            absentSubjects: absentSubjects,
            subjectCount: absentSubjects.length,
            timestamp: new Date().toISOString()
          };

        } catch (error) {
          console.error(`❌ WhatsApp error for ${student.studentID}:`, error);
          return {
            studentID: student.studentID,
            studentName: student.name,
            parentPhone: student.parentPhone,
            success: false,
            error: error.message,
            messageType: isFullDayAbsent ? 'full_day' : 'partial_day',
            absentSubjects: absentSubjects,
            timestamp: new Date().toISOString()
          };
        }
      });

      const batchResults = await Promise.all(batchPromises);
      whatsappResults.push(...batchResults);
      
      totalProcessed += batch.length;
      console.log(`📊 Processed ${totalProcessed}/${studentsToNotify.length} messages`);
      
      // ✅ Delay between batches to avoid rate limiting
      if (totalProcessed < studentsToNotify.length) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
    
    const successCount = whatsappResults.filter(r => r.success).length;
    const failureCount = whatsappResults.length - successCount;
    const fullDayCount = whatsappResults.filter(r => r.messageType === 'full_day' && r.success).length;
    const partialDayCount = whatsappResults.filter(r => r.messageType === 'partial_day' && r.success).length;
    
    // ✅ Enhanced message logging with detailed analytics
    const messageLogData = {
      date: dateKey,
      stream: stream.toUpperCase(),
      semester: parseInt(sem),
      messagesSent: successCount,
      messagesFailed: failureCount,
      totalStudentsNotified: studentsToNotify.length,
      fullDayAbsentCount: fullDayCount,
      partialDayAbsentCount: partialDayCount,
      subjectsIncluded: subjectsWithAttendance.map(s => s.subject),
      sentAt: new Date(),
      sentBy: forceResend ? 'manual-force' : 'manual',
      processingTime: Date.now() - Date.now(), // Will be calculated
      successRate: ((successCount / whatsappResults.length) * 100).toFixed(1),
      whatsappResults: whatsappResults.map(r => ({
        studentID: r.studentID,
        studentName: r.studentName,
        success: r.success,
        messageType: r.messageType,
        error: r.error,
        timestamp: r.timestamp
      })),
      analytics: {
        totalStudents: allStudents.length,
        presentStudents: presentStudentsSet.size,
        absentStudents: studentsToNotify.length,
        attendanceRate: ((presentStudentsSet.size / allStudents.length) * 100).toFixed(1)
      }
    };
    
    await MessageLog.findOneAndUpdate(
      {
        date: dateKey,
        stream: stream.toUpperCase(),
        semester: parseInt(sem)
      },
      messageLogData,
      { upsert: true, new: true }
    );
    
    console.log(`✅ Manual messaging completed: ${successCount}/${whatsappResults.length} messages sent`);
    
    // ✅ Enhanced response with better analytics
    res.json({
      success: true,
      message: successCount === whatsappResults.length 
        ? `✅ All absence messages sent successfully!` 
        : `⚠️ Messages sent with ${failureCount} failures`,
      date: formatDate,
      stream: stream.toUpperCase(),
      semester: sem,
      summary: {
        totalStudents: allStudents.length,
        subjectsWithAttendance: subjectsWithAttendance.length,
        studentsToNotify: studentsToNotify.length,
        messagesSent: successCount,
        messagesFailed: failureCount,
        successRate: ((successCount / whatsappResults.length) * 100).toFixed(1) + '%',
        fullDayAbsent: fullDayCount,
        partialDayAbsent: partialDayCount,
        isForceResend: forceResend,
        attendanceRate: ((presentStudentsSet.size / allStudents.length) * 100).toFixed(1) + '%'
      },
      subjectsIncluded: subjectsWithAttendance.map(s => s.subject),
      whatsappResults: whatsappResults,
      triggeredAt: new Date().toISOString(),
      triggerType: forceResend ? 'manual-force' : 'manual',
      nextActions: {
        viewHistory: `/api/message-history/${stream}/sem${sem}`,
        viewSummary: `/api/daily-absence-summary/${stream}/sem${sem}/${date}`
      }
    });
    
  } catch (error) {
    console.error("❌ Error in manual messaging:", error);
    
    // ✅ Enhanced error logging
    try {
      const MessageLog = getMessageLogModel();
      await MessageLog.findOneAndUpdate(
        {
          date: new Date(date).toISOString().slice(0, 10),
          stream: stream.toUpperCase(),
          semester: parseInt(sem)
        },
        {
          messagesSent: 0,
          messagesFailed: 0,
          totalStudentsNotified: 0,
          sentAt: new Date(),
          error: error.message,
          errorStack: error.stack,
          sentBy: 'manual-error'
        },
        { upsert: true, new: true }
      );
    } catch (logError) {
      console.error("❌ Failed to log error:", logError);
    }
    
    res.status(500).json({
      success: false,
      message: "Failed to send messages",
      error: error.message,
      suggestion: "Please try again or contact system administrator",
      timestamp: new Date().toISOString()
    });
  }
});

// ✅ ENHANCED: GET Daily Absence Summary (with sent message status)
router.get("/daily-absence-summary/:stream/sem:sem/:date", validateParams, async (req, res) => {
  const { stream, sem, date } = req.params;
  
  try {
    console.log(`📊 Getting daily absence summary for ${stream} Semester ${sem} on ${date}`);
    
    const Student = getStudentModel(stream, sem);
    const Subject = getSubjectModel(stream, sem);
    const MessageLog = getMessageLogModel();
    
    const dateKey = new Date(date).toISOString().slice(0, 10);
    
    // ✅ Parallel data fetching
    const [messageLog, allStudents, allSubjects] = await Promise.all([
      MessageLog.findOne({
        date: dateKey,
        stream: stream.toUpperCase(),
        semester: parseInt(sem)
      }).lean(),
      Student.find(getActiveStudentQuery(), "studentID name parentPhone").lean(),
      Subject.find({}, "subjectName").lean()
    ]);
    
    if (allStudents.length === 0 || allSubjects.length === 0) {
      return res.status(404).json({ 
        success: false,
        message: "No students or subjects found for this stream and semester",
        details: {
          studentsFound: allStudents.length,
          subjectsFound: allSubjects.length
        }
      });
    }
    
    // ✅ Optimized attendance record fetching
    const attendancePromises = allSubjects.map(async (subject) => {
      try {
        const Attendance = getAttendanceModel(stream, sem, subject.subjectName);
        const record = await Attendance.findOne(
          { date: new Date(date) },
          { studentsPresent: 1, totalStudents: 1, createdAt: 1 }
        ).lean();
        
        return {
          subject: subject.subjectName,
          studentsPresent: record ? record.studentsPresent : [],
          totalMarked: record ? record.studentsPresent.length : 0,
          hasAttendance: !!record,
          markedAt: record ? record.createdAt : null
        };
      } catch (error) {
        return {
          subject: subject.subjectName,
          studentsPresent: [],
          totalMarked: 0,
          hasAttendance: false,
          error: error.message
        };
      }
    });
    
    const allAttendanceRecords = await Promise.all(attendancePromises);
    const subjectsWithAttendance = allAttendanceRecords.filter(r => r.hasAttendance);
    
    // ✅ Enhanced absence calculation with performance optimization
    const attendanceMap = new Map(
      subjectsWithAttendance.map(record => [record.subject, new Set(record.studentsPresent)])
    );
    
    const absenceSummary = allStudents.map(student => {
      const absentSubjects = [];
      const presentSubjects = [];
      
      subjectsWithAttendance.forEach(record => {
        if (attendanceMap.get(record.subject).has(student.studentID)) {
          presentSubjects.push(record.subject);
        } else {
          absentSubjects.push(record.subject);
        }
      });
      
      const isFullDayAbsent = absentSubjects.length === subjectsWithAttendance.length && subjectsWithAttendance.length > 0;
      const attendancePercentage = subjectsWithAttendance.length > 0 
        ? ((presentSubjects.length / subjectsWithAttendance.length) * 100).toFixed(1)
        : '0.0';
      
      return {
        studentID: student.studentID,
        studentName: student.name,
        parentPhone: student.parentPhone,
        absentSubjects: absentSubjects,
        presentSubjects: presentSubjects,
        absentSubjectCount: absentSubjects.length,
        presentSubjectCount: presentSubjects.length,
        totalSubjectsWithAttendance: subjectsWithAttendance.length,
        attendancePercentage: attendancePercentage,
        isFullDayAbsent: isFullDayAbsent,
        isFullyPresent: absentSubjects.length === 0 && subjectsWithAttendance.length > 0,
        messageType: isFullDayAbsent ? 'full_day' : absentSubjects.length > 0 ? 'partial_day' : 'present',
        willReceiveMessage: absentSubjects.length > 0 && student.parentPhone,
        hasValidPhone: !!student.parentPhone
      };
    });
    
    const studentsToNotify = absenceSummary.filter(s => s.absentSubjectCount > 0 && s.hasValidPhone);
    const fullDayAbsent = absenceSummary.filter(s => s.isFullDayAbsent);
    const partialDayAbsent = absenceSummary.filter(s => s.absentSubjectCount > 0 && !s.isFullDayAbsent);
    const fullyPresent = absenceSummary.filter(s => s.isFullyPresent);
    const noPhoneNumber = absenceSummary.filter(s => !s.hasValidPhone);
    
    const formatDate = new Date(date).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: '2-digit', 
      year: 'numeric'
    });
    
    // ✅ Enhanced response with comprehensive analytics
    const response = {
      success: true,
      date: formatDate,
      stream: stream.toUpperCase(),
      semester: sem,
      summary: {
        totalStudents: allStudents.length,
        totalSubjects: allSubjects.length,
        subjectsWithAttendance: subjectsWithAttendance.length,
        subjectsWithoutAttendance: allSubjects.length - subjectsWithAttendance.length,
        studentsToNotify: studentsToNotify.length,
        fullDayAbsent: fullDayAbsent.length,
        partialDayAbsent: partialDayAbsent.length,
        studentsPresent: fullyPresent.length,
        studentsWithoutPhone: noPhoneNumber.length,
        overallAttendanceRate: allStudents.length > 0 && subjectsWithAttendance.length > 0
          ? ((fullyPresent.length / allStudents.length) * 100).toFixed(1) + '%'
          : '0.0%'
      },
      absenceSummary: absenceSummary,
      subjects: allSubjects.map(s => s.subjectName),
      subjectsWithAttendance: subjectsWithAttendance.map(s => ({
        subject: s.subject,
        totalMarked: s.totalMarked,
        markedAt: s.markedAt
      })),
      consolidatedMessaging: {
        totalMessagesToSend: studentsToNotify.length,
        fullDayMessages: fullDayAbsent.filter(s => s.hasValidPhone).length,
        partialDayMessages: partialDayAbsent.filter(s => s.hasValidPhone).length,
        estimatedCost: studentsToNotify.length * 0.1 // Assuming 0.1 unit cost per message
      }
    };
    
    // ✅ Enhanced message status with detailed analytics
    if (messageLog && messageLog.messagesSent > 0) {
      response.messageStatus = {
        alreadySent: true,
        sentAt: messageLog.sentAt,
        messagesSent: messageLog.messagesSent,
        messagesFailed: messageLog.messagesFailed,
        successRate: messageLog.successRate,
        totalStudentsNotified: messageLog.totalStudentsNotified,
        fullDayAbsentCount: messageLog.fullDayAbsentCount,
        partialDayAbsentCount: messageLog.partialDayAbsentCount,
        sentBy: messageLog.sentBy,
        subjectsIncluded: messageLog.subjectsIncluded,
        timeSinceSent: Math.floor((Date.now() - new Date(messageLog.sentAt).getTime()) / (1000 * 60)) + ' minutes ago',
        note: "Messages have already been sent for this date. Use 'forceResend: true' to send again."
      };
    } else {
      response.messageStatus = {
        alreadySent: false,
        readyToSend: studentsToNotify.length > 0,
        note: studentsToNotify.length > 0 
          ? `Ready to send ${studentsToNotify.length} messages`
          : "No messages needed - all students present!"
      };
    }
    
    // ✅ Add helpful actions
    response.actions = {
      sendMessages: `/api/send-absence-messages/${stream}/sem${sem}/${date}`,
      forceResend: `/api/force-resend-messages/${stream}/sem${sem}/${date}`,
      messageHistory: `/api/message-history/${stream}/sem${sem}`,
      downloadReport: `/api/absence-report/${stream}/sem${sem}/${date}`
    };
    
    res.json(response);
    
  } catch (error) {
    console.error("❌ Error getting daily absence summary:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get daily absence summary",
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// ✅ ENHANCED: Get message sending history with better filtering and pagination
router.get("/message-history/:stream/sem:sem", validateParams, async (req, res) => {
  const { stream, sem } = req.params;
  const { 
    limit = 10, 
    page = 1, 
    fromDate,
    toDate,
    sentBy,
    minSuccessRate 
  } = req.query;
  
  try {
    const MessageLog = getMessageLogModel();
    
    // ✅ Enhanced filtering
    const filter = {
      stream: stream.toUpperCase(),
      semester: parseInt(sem)
    };
    
    if (fromDate) {
      filter.date = { $gte: new Date(fromDate).toISOString().slice(0, 10) };
    }
    if (toDate) {
      filter.date = { ...filter.date, $lte: new Date(toDate).toISOString().slice(0, 10) };
    }
    if (sentBy) {
      filter.sentBy = sentBy;
    }
    if (minSuccessRate) {
      filter.successRate = { $gte: parseFloat(minSuccessRate) };
    }
    
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    // ✅ Parallel execution for better performance
    const [history, total] = await Promise.all([
      MessageLog.find(filter)
        .sort({ date: -1, sentAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      MessageLog.countDocuments(filter)
    ]);
    
    // ✅ Enhanced history data
    const enhancedHistory = history.map(log => ({
      date: log.date,
      formattedDate: new Date(log.date).toLocaleDateString('en-IN'),
      sentAt: log.sentAt,
      timeSinceSent: Math.floor((Date.now() - new Date(log.sentAt).getTime()) / (1000 * 60 * 60)) + ' hours ago',
      messagesSent: log.messagesSent,
      messagesFailed: log.messagesFailed,
      successRate: log.successRate || ((log.messagesSent / (log.messagesSent + log.messagesFailed)) * 100).toFixed(1),
      totalStudentsNotified: log.totalStudentsNotified,
      fullDayAbsentCount: log.fullDayAbsentCount,
      partialDayAbsentCount: log.partialDayAbsentCount,
      subjectsIncluded: log.subjectsIncluded,
      subjectCount: log.subjectsIncluded ? log.subjectsIncluded.length : 0,
      sentBy: log.sentBy,
      processingTime: log.processingTime,
      analytics: log.analytics
    }));
    
    // ✅ Calculate summary statistics
    const summaryStats = {
      totalMessages: history.reduce((sum, log) => sum + log.messagesSent, 0),
      totalFailures: history.reduce((sum, log) => sum + log.messagesFailed, 0),
      averageSuccessRate: history.length > 0 
        ? (history.reduce((sum, log) => sum + (parseFloat(log.successRate) || 0), 0) / history.length).toFixed(1)
        : '0.0',
      totalDaysWithMessages: history.length,
      mostActiveDate: history.length > 0 ? history[0].date : null
    };
    
    res.json({
      success: true,
      stream: stream.toUpperCase(),
      semester: sem,
      history: enhancedHistory,
      summaryStats,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: total,
        pages: Math.ceil(total / parseInt(limit)),
        hasNext: skip + parseInt(limit) < total,
        hasPrev: parseInt(page) > 1
      },
      filters: {
        fromDate,
        toDate,
        sentBy,
        minSuccessRate
      }
    });
    
  } catch (error) {
    console.error("❌ Error getting message history:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get message history",
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// ✅ ENHANCED: Force resend messages (bypass duplicate prevention)
router.post("/force-resend-messages/:stream/sem:sem/:date", validateParams, async (req, res) => {
  console.log('🔄 Force resend triggered');
  
  // Set forceResend flag
  req.body.forceResend = true;
  req.body.reason = req.body.reason || 'Manual force resend requested';
  
  try {
    // Call the original send messages function with forceResend enabled
    const originalUrl = req.url.replace('/force-resend-messages/', '/send-absence-messages/');
    const sendMessageReq = {
      ...req,
      url: originalUrl,
      route: { ...req.route, path: originalUrl }
    };
    
    // Find and execute the send messages route
    const sendRoute = router.stack.find(layer => 
      layer.route && layer.route.path.includes('send-absence-messages')
    );
    
    if (sendRoute) {
      return sendRoute.route.stack[0].handle(sendMessageReq, res);
    } else {
      throw new Error('Send messages route not found');
    }
    
  } catch (error) {
    console.error('❌ Error in force resend:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to force resend messages',
      error: error.message,
      suggestion: 'Please try using the regular send messages endpoint with forceResend: true in the request body'
    });
  }
});

// ✅ NEW: Get absence report (downloadable format)
router.get("/absence-report/:stream/sem:sem/:date", validateParams, async (req, res) => {
  const { stream, sem, date } = req.params;
  const { format = 'json' } = req.query;
  
  try {
    // Get the daily absence summary first
    const summaryReq = {
      params: { stream, sem, date },
      query: {}
    };
    
    // This would typically call the summary function
    // For now, return a structured report format
    
    res.json({
      success: true,
      message: 'Report generation endpoint - implement based on your reporting needs',
      availableFormats: ['json', 'csv', 'xlsx', 'pdf'],
      reportData: {
        date: new Date(date).toLocaleDateString('en-IN'),
        stream: stream.toUpperCase(),
        semester: sem,
        generatedAt: new Date().toISOString()
      }
    });
    
  } catch (error) {
    console.error("❌ Error generating report:", error);
    res.status(500).json({
      success: false,
      message: "Failed to generate absence report",
      error: error.message
    });
  }
});

// ✅ FIXED: GET Attendance Register with Language Subject Support
// ✅ FIXED: Async error handler middleware
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

// ✅ FIXED: GET Attendance Register with Consistent Response Format
router.get("/attendance-register/:stream/sem:sem/:subject", validateParams, asyncHandler(async (req, res) => {
  const { stream, sem, subject } = req.params;

  try {
    console.log(`📊 Getting attendance register for: ${subject} in ${stream} Sem ${sem}`);
    
    const Student = getStudentModel(stream, sem);
    const Subject = getSubjectModel(stream, sem);
    const Attendance = getAttendanceModel(stream, sem, subject);

    // Get subject details to determine if it's a language subject
    const subjectDoc = await Subject.findOne({ 
      subjectName: subject.toUpperCase(),
      isActive: { $ne: false }
    });

    if (!subjectDoc) {
      return res.status(404).json({ 
        success: false,
        error: 'SUBJECT_NOT_FOUND',
        message: `Subject "${subject}" not found in ${stream} Semester ${sem}` 
      });
    }

    // Get filtered students based on subject type
    let students;
    let attendanceScope;

    if (subjectDoc.isLanguageSubject && subjectDoc.languageType) {
      // Language Subject: Only get students who chose this language
      students = await Student.find({
        ...getActiveStudentQuery(),
        languageSubject: subjectDoc.languageType
      }, "studentID name migrationGeneration languageSubject languageGroup");
      
      attendanceScope = {
        type: 'LANGUAGE_FILTERED',
        language: subjectDoc.languageType,
        note: `Only ${subjectDoc.languageType} students`,
        totalPossible: students.length
      };
      
      console.log(`🔤 Language subject: Found ${students.length} ${subjectDoc.languageType} students`);
      
    } else {
      // Core Subject: Get all students
      students = await Student.find(
        getActiveStudentQuery(), 
        "studentID name migrationGeneration languageSubject languageGroup"
      );
      
      attendanceScope = {
        type: 'ALL_STUDENTS',
        language: null,
        note: 'All students attend together',
        totalPossible: students.length
      };
      
      console.log(`📚 Core subject: Found ${students.length} total students`);
    }

    if (students.length === 0) {
      return res.status(404).json({ 
        success: false,
        error: 'NO_STUDENTS_FOUND',
        message: subjectDoc.isLanguageSubject ? 
          `No students found who chose ${subjectDoc.languageType} language` :
          "No students found for this stream and semester",
        attendanceScope
      });
    }

    // Get attendance records for this subject
    const attendanceRecords = await Attendance.find({
      subject: { $regex: new RegExp(`^${subject}$`, 'i') }
    }).sort({ date: 1 });

    console.log(`📅 Found ${attendanceRecords.length} attendance records for ${subject}`);

    // Build attendance map with proper student filtering
    const attendanceMap = {};
    const studentIDs = students.map(s => s.studentID);

    attendanceRecords.forEach(record => {
      const dateKey = new Date(record.date).toISOString().split("T")[0];
      
      // Only include students that are in our filtered list
      const filteredPresent = record.studentsPresent.filter(studentID => 
        studentIDs.includes(studentID)
      );
      
      attendanceMap[dateKey] = filteredPresent;
      
      // Debug log for first few records
      if (Object.keys(attendanceMap).length <= 3) {
        console.log(`📊 ${dateKey}: ${filteredPresent.length}/${students.length} present (${filteredPresent.join(', ')})`);
      }
    });

    // Calculate summary statistics
    const totalDates = Object.keys(attendanceMap).length;
    const avgAttendance = students.length > 0 && totalDates > 0 ?
      (students.reduce((sum, student) => {
        const attendedCount = Object.values(attendanceMap).filter(datePresent => 
          datePresent.includes(student.studentID)
        ).length;
        return sum + (attendedCount / totalDates) * 100;
      }, 0) / students.length).toFixed(1) : 0;

    console.log(`✅ Register loaded: ${students.length} students, ${totalDates} dates, ${avgAttendance}% avg`);

    // ✅ FIXED: Consistent success response format
    res.status(200).json({ 
      success: true,
      message: `Register loaded successfully for ${subject}`,
      students, 
      attendanceMap, 
      subject: subject.toUpperCase(), 
      stream: stream.toUpperCase(), 
      semester: parseInt(sem),
      subjectInfo: {
        name: subjectDoc.subjectName,
        type: subjectDoc.subjectType,
        isLanguageSubject: subjectDoc.isLanguageSubject,
        languageType: subjectDoc.languageType,
        credits: subjectDoc.credits
      },
      attendanceScope,
      summary: {
        totalStudents: students.length,
        totalDates: totalDates,
        averageAttendance: parseFloat(avgAttendance),
        attendanceRecords: attendanceRecords.length
      }
    });

  } catch (error) {
    console.error("❌ Error fetching attendance register:", error);
    res.status(500).json({ 
      success: false,
      error: 'SERVER_ERROR',
      message: "Failed to fetch attendance register",
      details: error.message 
    });
  }
}));

// ✅ FIXED: POST Bulk Attendance Update with Consistent Response Format
router.post("/update-attendance/:stream/sem:sem/:subject", validateParams, asyncHandler(async (req, res) => {
  const { stream, sem, subject } = req.params;
  const { attendanceMap } = req.body;

  console.log(`📊 Bulk update request for: ${subject} in ${stream} Sem ${sem}`);
  console.log(`📊 Attendance data received:`, attendanceMap);

  // ✅ Enhanced input validation
  if (!attendanceMap || typeof attendanceMap !== "object") {
    return res.status(400).json({ 
      success: false,
      error: 'INVALID_INPUT_FORMAT',
      message: "Invalid attendance data. Expected object with date keys and student arrays.",
      expectedFormat: {
        attendanceMap: {
          "2025-01-15": ["STU001", "STU002"],
          "2025-01-16": ["STU003", "STU004"]
        }
      }
    });
  }

  const dates = Object.keys(attendanceMap);
  if (dates.length === 0) {
    return res.status(400).json({ 
      success: false,
      error: 'EMPTY_ATTENDANCE_DATA',
      message: "No attendance data provided" 
    });
  }

  // ✅ Validate date formats
  const invalidDates = dates.filter(dateStr => {
    const isoRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!isoRegex.test(dateStr)) return true;
    const date = new Date(dateStr);
    return isNaN(date.getTime());
  });

  if (invalidDates.length > 0) {
    return res.status(400).json({
      success: false,
      error: 'INVALID_DATE_FORMAT',
      message: `Invalid date formats: ${invalidDates.join(', ')}`,
      invalidDates: invalidDates,
      hint: "Dates must be in YYYY-MM-DD format"
    });
  }

  try {
    const Student = getStudentModel(stream, sem);
    const Subject = getSubjectModel(stream, sem);
    const Attendance = getAttendanceModel(stream, sem, subject);

    // ✅ Validate subject exists
    const subjectDoc = await Subject.findOne({ 
      subjectName: subject.toUpperCase(),
      isActive: { $ne: false }
    });

    if (!subjectDoc) {
      return res.status(404).json({ 
        success: false,
        error: 'SUBJECT_NOT_FOUND',
        message: `Subject "${subject}" not found in ${stream} Semester ${sem}`
      });
    }

    // ✅ Get valid students for validation
    let validStudents;
    if (subjectDoc.isLanguageSubject && subjectDoc.languageType) {
      validStudents = await Student.find({
        ...getActiveStudentQuery(),
        languageSubject: subjectDoc.languageType
      }, "studentID");
    } else {
      validStudents = await Student.find(getActiveStudentQuery(), "studentID");
    }

    const validStudentIDs = validStudents.map(s => s.studentID);
    console.log(`👥 Valid students for ${subject}: ${validStudentIDs.length}`);

    if (validStudentIDs.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'NO_STUDENTS_FOUND',
        message: subjectDoc.isLanguageSubject ? 
          `No students found who chose ${subjectDoc.languageType} language` :
          "No students found for this stream and semester"
      });
    }

    // ✅ Validate student data in attendance map
    const invalidStudentData = [];

    for (const [dateStr, studentsPresent] of Object.entries(attendanceMap)) {
      if (!Array.isArray(studentsPresent)) {
        invalidStudentData.push(`Date ${dateStr}: Expected array, got ${typeof studentsPresent}`);
        continue;
      }

      studentsPresent.forEach(studentID => {
        if (typeof studentID !== 'string') {
          invalidStudentData.push(`Date ${dateStr}: Invalid student ID format: ${studentID}`);
        }
      });
    }

    if (invalidStudentData.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'INVALID_STUDENT_DATA',
        message: "Invalid student data in attendance map",
        details: invalidStudentData
      });
    }

    // ✅ Use transaction for data consistency
    const session = await Attendance.startSession();
    let updateResults = [];

    try {
      await session.withTransaction(async () => {
        const updatePromises = dates.map(async (dateStr) => {
          const studentsPresent = attendanceMap[dateStr];
          
          // Filter to only include valid students
          const filteredPresent = studentsPresent.filter(studentID => 
            validStudentIDs.includes(studentID)
          );

          const dateObj = new Date(dateStr);
          
          console.log(`📅 Updating ${dateStr}: ${filteredPresent.length}/${validStudentIDs.length} present`);

          const result = await Attendance.findOneAndUpdate(
            { 
              date: dateObj, 
              subject: subject.toUpperCase()
            },
            { 
              $set: { 
                studentsPresent: filteredPresent,
                totalStudents: validStudentIDs.length,
                stream: stream.toUpperCase(),
                semester: parseInt(sem),
                isLanguageSubject: subjectDoc.isLanguageSubject,
                languageType: subjectDoc.languageType || null,
                lastUpdated: new Date(),
                updatedBy: 'bulk_update'
              }
            },
            { 
              upsert: true, 
              new: true,
              session
            }
          );

          return {
            date: dateStr,
            totalStudents: validStudentIDs.length,
            presentStudents: filteredPresent.length,
            attendanceId: result._id
          };
        });

        updateResults = await Promise.all(updatePromises);
      });

      console.log(`✅ Transaction completed successfully for ${dates.length} dates`);

    } finally {
      await session.endSession();
    }

    // ✅ CRITICAL FIX: Consistent success response with success: true
    const totalPresent = updateResults.reduce((sum, result) => sum + result.presentStudents, 0);
    const avgAttendance = updateResults.length > 0 ? 
      (totalPresent / (updateResults.length * validStudentIDs.length) * 100).toFixed(1) : 0;

    res.status(200).json({ 
      success: true, // ✅ This was missing - causing frontend confusion
      message: `✅ Attendance updated successfully for ${dates.length} dates`,
      updatedDates: dates.length,
      summary: {
        totalDates: dates.length,
        totalStudents: validStudentIDs.length,
        averageAttendance: parseFloat(avgAttendance),
        updateResults: updateResults
      },
      subjectInfo: {
        name: subjectDoc.subjectName,
        type: subjectDoc.subjectType,
        isLanguageSubject: subjectDoc.isLanguageSubject,
        languageType: subjectDoc.languageType
      }
    });

  } catch (error) {
    console.error("❌ Server error while updating attendance:", error);
    
    res.status(500).json({ 
      success: false,
      error: 'SERVER_ERROR',
      message: "Server error while updating attendance",
      details: error.message,
      context: {
        subject,
        stream,
        semester: sem,
        requestedDates: dates.length
      }
    });
  }
}));

// ✅ FIXED: Debug route with consistent format
router.get("/debug/test-bcom-mapping", asyncHandler(async (req, res) => {
  const stream = "BCom A and F";
  const semester = "5";
  
  try {
    // Test the mapping
    const studentCollection = getCollectionName(stream, semester, "students");
    const subjectCollection = getCollectionName(stream, semester, "subjects");
    
    // Test direct access to your collection
    const StudentModel = mongoose.model('TestBComStudents', studentSchema, 'bcom_a_and_f_sem5_students');
    const count = await StudentModel.countDocuments();
    const sample = await StudentModel.findOne();
    
    res.json({
      success: true,
      message: "Debug mapping test completed",
      mapping: {
        input: { stream, semester },
        output: {
          students: studentCollection,
          subjects: subjectCollection
        },
        expected: "bcom_a_and_f_sem5_students"
      },
      directAccess: {
        collectionName: "bcom_a_and_f_sem5_students",
        documentCount: count,
        sampleStudent: sample ? {
          studentID: sample.studentID,
          name: sample.name,
          isActive: sample.isActive
        } : null
      },
      mappingCorrect: studentCollection === "bcom_a_and_f_sem5_students"
    });
  } catch (error) {
    res.status(500).json({ 
      success: false,
      error: 'DEBUG_ERROR',
      message: "Debug test failed",
      details: error.message 
    });
  }
}));

// ✅ FIXED: Reports route with consistent format
router.get("/reports/student-subject-report/:stream/sem:sem", validateParams, asyncHandler(async (req, res) => {
  const { stream, sem } = req.params;
  
  try {
    console.log(`📊 Generating report for: ${stream} Semester ${sem}`);
    
    let studentCollectionName, subjectCollectionName;
    
    // Handle BCom A and F specifically
    if (stream === "BCom A and F" && sem === "5") {
      studentCollectionName = "bcom_a_and_f_sem5_students";
      subjectCollectionName = "bcom_a_and_f_sem5_subjects";
      console.log(`🎯 Using exact collection names for BCom A and F`);
    } else {
      // Use mapping function for other streams
      studentCollectionName = getCollectionName(stream, sem, "students");
      subjectCollectionName = getCollectionName(stream, sem, "subjects");
    }
    
    console.log(`🗂️ Collections: ${studentCollectionName}, ${subjectCollectionName}`);
    
    // Create models with exact collection names
    const StudentModel = mongoose.models[studentCollectionName] || 
      mongoose.model(studentCollectionName, studentSchema, studentCollectionName);
    const SubjectModel = mongoose.models[subjectCollectionName] || 
      mongoose.model(subjectCollectionName, subjectSchema, subjectCollectionName);
    
    // Fetch data
    const students = await StudentModel.find({ isActive: true }).lean();
    const subjects = await SubjectModel.find().lean();
    
    console.log(`✅ Found ${students.length} students and ${subjects.length} subjects`);
    
    if (students.length === 0) {
      return res.status(404).json({ 
        success: false,
        error: 'NO_STUDENTS_FOUND',
        message: `No students found in collection: ${studentCollectionName}` 
      });
    }
    
    // Build report data
    const reportData = {
      success: true,
      message: "Report generated successfully",
      stream: stream.toUpperCase(),
      semester: parseInt(sem),
      reportDate: new Date().toLocaleDateString('en-IN'),
      totalStudents: students.length,
      totalSubjects: subjects.length,
      subjects: subjects.map(s => s.subjectName),
      students: students.map(student => ({
        studentID: student.studentID,
        name: student.name,
        subjects: subjects.reduce((acc, subject) => {
          // Mock percentage for now - replace with actual attendance calculation
          acc[subject.subjectName] = {
            attended: Math.floor(Math.random() * 20) + 15,
            total: 30,
            percentage: Math.floor(Math.random() * 25) + 75 // 75-100%
          };
          return acc;
        }, {})
      }))
    };
    
    console.log(`🎉 Report generated successfully!`);
    res.json(reportData);
    
  } catch (error) {
    console.error(`❌ Report error:`, error);
    res.status(500).json({ 
      success: false,
      error: 'REPORT_ERROR',
      message: "Failed to generate report",
      details: error.message 
    });
  }
}));

// ✅ ADD THIS ROUTE to your backend (e.g., in routes/attendance.js)
router.get("/attendance-students/:stream/sem:sem/:subject", validateParams, async (req, res) => {
  const { stream, sem, subject } = req.params;

  try {
    console.log(`📊 Getting students for: ${subject} in ${stream} Sem ${sem}`);
    
    const Student = getStudentModel(stream, sem);
    const Subject = getSubjectModel(stream, sem);

    // Get subject details to determine filtering
    const subjectDoc = await Subject.findOne({ 
      subjectName: subject.toUpperCase(),
      isActive: { $ne: false }
    });

    if (!subjectDoc) {
      return res.status(404).json({ 
        success: false,
        message: `Subject "${subject}" not found in ${stream} Semester ${sem}` 
      });
    }

    // Filter students based on subject type
    let students;
    if (subjectDoc.isLanguageSubject && subjectDoc.languageType) {
      // Language Subject: Only get students who chose this language
      students = await Student.find({
        ...getActiveStudentQuery(),
        languageSubject: subjectDoc.languageType
      }, "studentID name languageSubject");
      
      console.log(`🔤 Found ${students.length} ${subjectDoc.languageType} students`);
    } else {
      // Core Subject: Get all students
      students = await Student.find(
        getActiveStudentQuery(), 
        "studentID name languageSubject"
      );
      
      console.log(`📚 Found ${students.length} total students`);
    }

    // Return JSON response
    res.json({
      success: true,
      students,
      subject: {
        name: subjectDoc.subjectName,
        isLanguageSubject: subjectDoc.isLanguageSubject,
        languageType: subjectDoc.languageType,
        type: subjectDoc.subjectType
      },
      message: subjectDoc.isLanguageSubject ? 
        `${subjectDoc.languageType} language students only` : 
        'All students'
    });

  } catch (error) {
    console.error("❌ Error fetching students:", error);
    res.status(500).json({ 
      success: false,
      message: "Failed to fetch students for subject",
      error: error.message 
    });
  }
});

module.exports = router;
