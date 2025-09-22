// Quick test to verify the conservative logic changes
const { WebScraperService } = require('./dist/services/WebScraperService');

async function testConservativeLogic() {
  console.log('🧪 Testing conservative logic changes...');
  
  // Create a test server URL that will return appointments without clear status indicators
  const testUrl = 'http://localhost:3001';
  const scraper = new WebScraperService(testUrl);
  
  try {
    // Test with minimal filters to see how appointments are classified
    const filters = {
      city: ['isfahan'],
      examModel: ['cdielts'],
      months: [2]
    };
    
    console.log('📋 Testing appointment status detection...');
    const result = await scraper.fetchAppointmentsWithStatus(filters);
    
    console.log('\n📊 Results:');
    console.log(`Total appointments: ${result.appointmentCount}`);
    console.log(`Available: ${result.availableCount}`);
    console.log(`Filled: ${result.filledCount}`);
    
    // Check individual appointments
    if (result.appointments.length > 0) {
      console.log('\n📝 Individual appointments:');
      result.appointments.forEach((apt, index) => {
        console.log(`${index + 1}. ${apt.date} ${apt.time} - ${apt.location} (${apt.status})`);
        if (apt.statusIndicators) {
          console.log(`   Indicators: ${apt.statusIndicators.join(', ')}`);
        }
        if (apt.parsingNotes) {
          console.log(`   Notes: ${apt.parsingNotes.join(', ')}`);
        }
      });
    }
    
    // Verify no appointments are marked as available without explicit indicators
    const availableWithoutIndicators = result.appointments.filter(apt => 
      apt.status === 'available' && 
      (!apt.statusIndicators || apt.statusIndicators.length === 0)
    );
    
    if (availableWithoutIndicators.length > 0) {
      console.log('\n❌ ISSUE: Found appointments marked as available without indicators:');
      availableWithoutIndicators.forEach(apt => {
        console.log(`   - ${apt.date} ${apt.time} - ${apt.location}`);
      });
    } else {
      console.log('\n✅ SUCCESS: No appointments marked as available without explicit indicators');
    }
    
    // Check for unknown status appointments (should exist with conservative logic)
    const unknownAppointments = result.appointments.filter(apt => apt.status === 'unknown');
    console.log(`\n🔍 Unknown status appointments: ${unknownAppointments.length}`);
    if (unknownAppointments.length > 0) {
      console.log('✅ Good: Conservative logic is working - unclear appointments marked as unknown');
    }
    
  } catch (error) {
    console.log('\n⚠️  Test requires test simulation server to be running');
    console.log('   Run: cd test-simulation && npm start');
    console.log(`   Error: ${error.message}`);
  } finally {
    await scraper.close();
  }
}

testConservativeLogic().catch(console.error);