import Navigation from '../Navigation';

export default function NavigationExample() {
  const handleLogout = () => {
    console.log('Logout clicked');
  };

  return (
    <Navigation 
      userRole="admin" 
      userEmail="admin@school.edu" 
      onLogout={handleLogout} 
    />
  );
}
