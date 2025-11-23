import LoginPage from '../LoginPage';

export default function LoginPageExample() {
  const handleLogin = async (email: string, password: string) => {
    console.log('Login attempt:', email, password);
    return Promise.resolve();
  };

  return <LoginPage onLogin={handleLogin} />;
}
