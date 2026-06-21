import { redirect } from 'next/navigation';

export default function Home() {
  // מעביר אוטומטית את מי שנכנס לעמוד הראשי לעמוד פתיחת הכיתות למורים
  redirect('/register');
}
