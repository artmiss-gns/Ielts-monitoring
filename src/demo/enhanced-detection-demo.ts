#!/usr/bin/env ts-node

/**
 * Demonstration script for enhanced appointment detection capabilities
 */

import { AppointmentDetectionService } from '../services/AppointmentDetectionService';
import { Appointment, CheckResult } from '../models/types';

// Mock data for demonstration
const createMockAppointment = (
  id: string, 
  date: string, 
  time: string, 
  status: 'available' | 'filled' | 'pending' | 'not-registerable' = 'available'
): Appointment => ({
  id,
  date,
  time,
  location: 'Isfahan Test Center',
  examType: 'IELTS',
  city: 'Isfahan',
  status,
  price: 5000000,
  ...(status === 'available' ? { registrationUrl: 'https://example.com/register' } : {})
});

const createMockCheckResult = (appointments: Appointment[]): CheckResult => ({
  type: appointments.some(apt => apt.status === 'available') ? 'available' : 'filled',
  appointmentCount: appointments.length,
  availableCount: appointments.filter(apt => apt.status === 'available').length,
  filledCount: appointments.filter(apt => apt.status !== 'available').length,
  timestamp: new Date(),
  url: 'https://irsafam.org/ielts/timetable',
  appointments
});

async function demonstrateEnhancedDetection() {
  console.log('🚀 Enhanced Appointment Detection Demonstration\n');
  
  // Initialize the detection service
  const detectionService = new AppointmentDetectionService({
    trackingDataFile: 'demo-data/appointment-tracking.json',
    maxTrackingDays: 30,
    statusChangeThreshold: 5
  });
  
  await detectionService.initialize();
  
  console.log('📊 Initial Statistics:');
  console.log(detectionService.getTrackingStatistics());
  console.log('');
  
  // Scenario 1: First check with mixed appointment statuses
  console.log('🔍 Scenario 1: First check with mixed appointment statuses');
  const firstCheckAppointments = [
    createMockAppointment('apt-001', '2024-12-15', '09:00-12:00', 'available'),
    createMockAppointment('apt-002', '2024-12-15', '13:00-16:00', 'filled'),
    createMockAppointment('apt-003', '2024-12-16', '09:00-12:00', 'pending'),
    createMockAppointment('apt-004', '2024-12-16', '13:00-16:00', 'available')
  ];
  
  const firstCheck = createMockCheckResult(firstCheckAppointments);
  const firstResult = await detectionService.processAppointments(firstCheck);
  
  console.log(`✅ New available appointments: ${firstResult.newAvailableAppointments.length}`);
  firstResult.newAvailableAppointments.forEach(apt => {
    console.log(`   - ${apt.date} ${apt.time} [${apt.status.toUpperCase()}]`);
  });
  
  console.log(`📊 Updated Statistics:`);
  console.log(detectionService.getTrackingStatistics());
  console.log('');
  
  // Scenario 2: Status changes - some appointments become available
  console.log('🔄 Scenario 2: Status changes - some appointments become available');
  const secondCheckAppointments = [
    createMockAppointment('apt-001', '2024-12-15', '09:00-12:00', 'available'), // unchanged
    createMockAppointment('apt-002', '2024-12-15', '13:00-16:00', 'available'), // filled -> available
    createMockAppointment('apt-003', '2024-12-16', '09:00-12:00', 'filled'),    // pending -> filled
    createMockAppointment('apt-004', '2024-12-16', '13:00-16:00', 'filled'),    // available -> filled
    createMockAppointment('apt-005', '2024-12-17', '09:00-12:00', 'available')  // new appointment
  ];
  
  const secondCheck = createMockCheckResult(secondCheckAppointments);
  const secondResult = await detectionService.processAppointments(secondCheck);
  
  console.log(`✅ New available appointments: ${secondResult.newAvailableAppointments.length}`);
  secondResult.newAvailableAppointments.forEach(apt => {
    console.log(`   - ${apt.date} ${apt.time} [${apt.status.toUpperCase()}]`);
  });
  
  console.log(`🔄 Status changed appointments: ${secondResult.statusChangedAppointments.length}`);
  secondResult.statusChangedAppointments.forEach(apt => {
    console.log(`   - ${apt.date} ${apt.time} [${apt.status.toUpperCase()}]`);
  });
  
  console.log(`📊 Updated Statistics:`);
  console.log(detectionService.getTrackingStatistics());
  console.log('');
  
  // Scenario 3: Test notification filtering
  console.log('🔔 Scenario 3: Testing notification filtering');
  const allAvailableAppointments = secondCheckAppointments.filter(apt => apt.status === 'available');
  const notifiableAppointments = detectionService.getNotifiableAppointments(allAvailableAppointments);
  
  console.log(`📧 Available appointments: ${allAvailableAppointments.length}`);
  console.log(`📧 Notifiable appointments: ${notifiableAppointments.length}`);
  notifiableAppointments.forEach(apt => {
    console.log(`   - ${apt.date} ${apt.time} [${apt.status.toUpperCase()}]`);
  });
  
  // Mark some as notified
  if (notifiableAppointments.length > 0) {
    await detectionService.markAsNotified([notifiableAppointments[0].id]);
    console.log(`✅ Marked ${notifiableAppointments[0].id} as notified`);
  }
  
  // Test notification filtering again
  const notifiableAfterMarking = detectionService.getNotifiableAppointments(allAvailableAppointments);
  console.log(`📧 Notifiable appointments after marking: ${notifiableAfterMarking.length}`);
  console.log('');
  
  // Scenario 4: Appointment removal
  console.log('📤 Scenario 4: Appointment removal');
  const thirdCheckAppointments = [
    createMockAppointment('apt-002', '2024-12-15', '13:00-16:00', 'available'),
    createMockAppointment('apt-005', '2024-12-17', '09:00-12:00', 'available')
    // apt-001, apt-003, apt-004 are removed
  ];
  
  const thirdCheck = createMockCheckResult(thirdCheckAppointments);
  const thirdResult = await detectionService.processAppointments(thirdCheck);
  
  console.log(`📤 Removed appointments: ${thirdResult.removedAppointments.length}`);
  thirdResult.removedAppointments.forEach(apt => {
    console.log(`   - ${apt.appointment.date} ${apt.appointment.time} [${apt.appointment.status.toUpperCase()}]`);
  });
  
  console.log(`📊 Final Statistics:`);
  console.log(detectionService.getTrackingStatistics());
  console.log('');
  
  // Show recent status changes
  console.log('📈 Recent Status Changes:');
  const recentChanges = detectionService.getRecentStatusChanges(60);
  recentChanges.forEach(change => {
    console.log(`   - ${change.timestamp.toLocaleTimeString()}: ${change.previousStatus} → ${change.newStatus} (${change.reason})`);
  });
  
  console.log('\n🎉 Enhanced Appointment Detection Demonstration Complete!');
  console.log('\nKey Features Demonstrated:');
  console.log('✅ Accurate status detection (available, filled, pending, not-registerable)');
  console.log('✅ Duplicate prevention - no repeated notifications for same appointments');
  console.log('✅ Status change tracking with history');
  console.log('✅ Appointment removal detection');
  console.log('✅ Comprehensive statistics and logging');
  console.log('✅ Smart notification filtering');
}

// Run the demonstration
if (require.main === module) {
  demonstrateEnhancedDetection().catch(console.error);
}

export { demonstrateEnhancedDetection };