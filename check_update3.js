const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

const envContent = fs.readFileSync('.env.local', 'utf-8');
const envVars = {};
envContent.split('\n').forEach(line => {
  const [key, ...val] = line.split('=');
  if (key && val) {
    envVars[key.trim()] = val.join('=').trim().replace(/['"]/g, '');
  }
});

const supabase = createClient(envVars.NEXT_PUBLIC_SUPABASE_URL, envVars.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function testUpdate() {
  const { data: classes } = await supabase.from('classes').select('id, bottom_message').limit(1);
  const classId = classes[0].id;
  const oldMsg = classes[0].bottom_message;
  console.log('Old:', oldMsg);
  
  const { error } = await supabase
    .from('classes')
    .update({ bottom_message: oldMsg + ' 1' })
    .eq('id', classId);
    
  if (error) {
    console.error('Update error:', error);
  } else {
    console.log('Update success!');
    const { data } = await supabase.from('classes').select('bottom_message, share_prompt').eq('id', classId).single();
    console.log('After update:', data);
  }
}

testUpdate();
