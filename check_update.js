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
  const { data: classes } = await supabase.from('classes').select('id').limit(1);
  if (!classes || classes.length === 0) return console.log('No classes found');
  
  const classId = classes[0].id;
  console.log(`Updating class ${classId}...`);
  
  const { error } = await supabase
    .from('classes')
    .update({ share_prompt: '', share_subtitle: '' })
    .eq('id', classId);
    
  if (error) {
    console.error('Update error:', error);
  } else {
    console.log('Update success!');
    
    // verify
    const { data } = await supabase.from('classes').select('share_prompt, share_subtitle').eq('id', classId).single();
    console.log('After update:', data);
  }
}

testUpdate();
