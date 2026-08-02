import React, { useState } from 'react';
import { StyleSheet, View, ScrollView } from 'react-native';
import { Button, Card, Text, TextInput, Avatar } from 'react-native-paper';
import { getSupabase } from '../utils/supabase';

interface LoginScreenProps {
  onLoginSuccess: () => void;
  onChangeConnection: () => void;
}

export default function LoginScreen({ onLoginSuccess, onChangeConnection }: LoginScreenProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const handleAuth = async () => {
    if (!email || !password) {
      setError('કૃપા કરીને ઇમેઇલ અને પાસવર્ડ બંને દાખલ કરો.');
      return;
    }
    if (password.length < 6) {
      setError('પાસવર્ડ ઓછામાં ઓછો ૬ અક્ષરનો હોવો જોઈએ.');
      return;
    }

    setError('');
    setMessage('');
    setLoading(true);
    const supabase = getSupabase();

    try {
      if (isSignUp) {
        const { data, error: signUpError } = await supabase.auth.signUp({
          email: email.trim(),
          password: password,
        });
        if (signUpError) throw signUpError;
        
        if (data.session) {
          onLoginSuccess();
        } else {
          setMessage('નોંધણી સફળ! કૃપા કરીને તમારા ઇમેઇલ પર આવેલ કન્ફર્મેશન લિંક ચેક કરો.');
        }
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password: password,
        });
        if (signInError) throw signInError;
        onLoginSuccess();
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'કોઈ અજાણી ભૂલ આવી. કૃપા કરીને ફરી પ્રયત્ન કરો.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Card style={styles.card} elevation={4}>
        <Card.Content>
          <View style={styles.logoContainer}>
            <Avatar.Icon size={64} icon="notebook" style={styles.logoIcon} color="#ffffff" />
            <Text style={styles.title}>ડિજિટલ ખાતા બુક</Text>
            <Text style={styles.tagline}>ઓનલાઇન કનેક્ટેડ ડિજિટલ ચોપડો</Text>
          </View>

          <View style={styles.divider} />

          <Text style={styles.subtitle}>{isSignUp ? 'નવું એકાઉન્ટ બનાવો' : 'ખાતામાં પ્રવેશ કરો'}</Text>

          {error ? <Text style={styles.error}>{error}</Text> : null}
          {message ? <Text style={styles.success}>{message}</Text> : null}

          <TextInput
            label="ઇમેઇલ એડ્રેસ"
            value={email}
            onChangeText={setEmail}
            mode="outlined"
            placeholder="example@email.com"
            style={styles.input}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            disabled={loading}
            outlineColor="#bdbdbd"
            activeOutlineColor="#1a73e8"
            left={<TextInput.Icon icon="email-outline" />}
          />

          <TextInput
            label="પાસવર્ડ"
            value={password}
            onChangeText={setPassword}
            mode="outlined"
            secureTextEntry
            placeholder="******"
            style={styles.input}
            autoCapitalize="none"
            autoCorrect={false}
            disabled={loading}
            outlineColor="#bdbdbd"
            activeOutlineColor="#1a73e8"
            left={<TextInput.Icon icon="lock-outline" />}
          />

          <Button
            mode="contained"
            onPress={handleAuth}
            loading={loading}
            disabled={loading}
            style={styles.button}
            contentStyle={styles.buttonContent}
            buttonColor="#1a73e8"
          >
            {isSignUp ? 'નોંધણી કરો (Sign Up)' : 'પ્રવેશ કરો (Login)'}
          </Button>

          <Button
            mode="text"
            onPress={() => setIsSignUp(!isSignUp)}
            disabled={loading}
            textColor="#1a73e8"
            style={styles.toggleButton}
          >
            {isSignUp ? 'પહેલેથી એકાઉન્ટ છે? લોગીન કરો' : 'નવું એકાઉન્ટ બનાવવું છે? સાઇન અપ કરો'}
          </Button>

          <Button
            mode="text"
            onPress={onChangeConnection}
            disabled={loading}
            textColor="#7f8c8d"
            style={styles.connectionButton}
            labelStyle={styles.connectionLabel}
          >
            કનેક્શન સેટિંગ્સ બદલો (Reset Setup)
          </Button>
        </Card.Content>
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 20,
    backgroundColor: '#f8f9fa',
  },
  card: {
    padding: 12,
    borderRadius: 16,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  logoContainer: {
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 16,
  },
  logoIcon: {
    backgroundColor: '#1a73e8',
    marginBottom: 10,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2c3e50',
    textAlign: 'center',
  },
  tagline: {
    fontSize: 12,
    color: '#7f8c8d',
    marginTop: 4,
    textAlign: 'center',
  },
  divider: {
    height: 1,
    backgroundColor: '#f0f0f0',
    marginVertical: 10,
    width: '100%',
  },
  subtitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#34495e',
    textAlign: 'center',
    marginBottom: 20,
  },
  input: {
    marginBottom: 16,
  },
  button: {
    marginTop: 10,
    borderRadius: 12,
  },
  buttonContent: {
    paddingVertical: 8,
  },
  toggleButton: {
    marginTop: 15,
  },
  connectionButton: {
    marginTop: 8,
  },
  connectionLabel: {
    fontSize: 11,
  },
  error: {
    color: '#d32f2f',
    backgroundColor: '#ffebee',
    padding: 8,
    borderRadius: 8,
    marginBottom: 16,
    textAlign: 'center',
    fontWeight: 'bold',
    fontSize: 13,
  },
  success: {
    color: '#2e7d32',
    backgroundColor: '#e8f5e9',
    padding: 8,
    borderRadius: 8,
    marginBottom: 16,
    textAlign: 'center',
    fontWeight: 'bold',
    fontSize: 13,
  },
});
