import { View, Text, Button } from 'react-native';
import { router } from 'expo-router';

export default function IndexPage() {
  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
      <Text style={{ fontSize: 24 }}>Welcome to Medical Test Organizer</Text>

      <Button title="Sign Up" onPress={() => router.push('/signup')} />
      <Button title="Login" onPress={() => router.push('/login')} />
    </View>
  );
}
