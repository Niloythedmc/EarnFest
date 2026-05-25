import { db } from '../config/db.js';

const tasks = [
  {
    title: 'Join @EidFestAnnouncements',
    reward: 0.1,
    link: 'https://t.me/EidFestAnnouncements',
    type: 'telegram',
    icon: 'send'
  },
  {
    title: 'Follow @EidFestHub on X',
    reward: 0.15,
    link: 'https://twitter.com/EidFestHub',
    type: 'twitter',
    icon: 'twitter'
  },
  {
    title: 'Subscribe to Eid Fest YT',
    reward: 0.2,
    link: 'https://youtube.com/@EidFestOfficial',
    type: 'youtube',
    icon: 'youtube'
  },
  {
    title: 'Join Eid Fest Chat',
    reward: 0.15,
    link: 'https://t.me/EidFestChat',
    type: 'telegram',
    icon: 'message-square'
  }
];

const seedTasks = async () => {
  console.log('Seeding tasks to Firestore...');
  try {
    const tasksCol = db.collection('tasks');
    
    for (const task of tasks) {
      await tasksCol.add({
        ...task,
        createdAt: new Date().toISOString()
      });
      console.log(`Added task: ${task.title}`);
    }
    
    console.log('Successfully seeded all tasks! ✅');
    process.exit(0);
  } catch (error) {
    console.error('Error seeding tasks:', error);
    process.exit(1);
  }
};

seedTasks();
