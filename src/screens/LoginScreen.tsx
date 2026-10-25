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
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [resetStep, setResetStep] = useState<1 | 2>(1); // 1 = Enter Email, 2 = Enter OTP + New Password
  const [resetOtp, setResetOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');

  const handleSendRecoveryOtp = async () => {
    if (!email.trim()) {
      setError('કૃપા કરીને ઇમેઇલ એડ્રેસ દાખલ કરો.');
      return;
    }

    setError('');
    setMessage('');
    setLoading(true);
    const supabase = getSupabase();

    try {
      // Use signInWithOtp which sends a 6-digit OTP email by default (Magic Link / OTP template)
      // Even with Supabase's default mailer and without custom SMTP, this delivers a direct 6-digit code.
      const { error: otpError } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: {
          shouldCreateUser: false, // Prevents creating a new account if email doesn't exist
        },
      });
      if (otpError) throw otpError;
      setResetStep(2);
      setMessage('તમારા ઇમેઇલ પર ૬ અંકનો સુરક્ષિત કોડ (OTP) મોકલી દેવામાં આવ્યો છે. નીચે કોડ અને નવો પાસવર્ડ દાખલ કરો.');
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'OTP કોડ મોકલવામાં સમસ્યા આવી.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtpAndSetPassword = async () => {
    const cleanOtp = resetOtp.trim();
    if (!cleanOtp) {
      setError('કૃપા કરીને ઇમેઇલ પર આવેલ ૬ અંકનો કોડ દાખલ કરો.');
      return;
    }
    if (!newPassword || newPassword.length < 6) {
      setError('નવો પાસવર્ડ ઓછામાં ઓછો ૬ અક્ષરનો હોવો જોઈએ.');
      return;
    }

    setError('');
    setMessage('');
    setLoading(true);
    const supabase = getSupabase();

    try {
      // 1. Verify the OTP token (supports both 'email' magic link OTP and 'recovery')
      let verifyRes = await supabase.auth.verifyOtp({
        email: email.trim(),
        token: cleanOtp,
        type: 'email',
      });

      if (verifyRes.error) {
        // Fallback to recovery type if email type failed
        verifyRes = await supabase.auth.verifyOtp({
          email: email.trim(),
          token: cleanOtp,
          type: 'recovery',
        });
      }

      if (verifyRes.error) throw verifyRes.error;

      // 2. Set the new password for the authenticated session
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (updateError) throw updateError;

      setMessage('પાસવર્ડ સફળતાપૂર્વક બદલાઈ ગયો છે! તમે હવે નવા પાસવર્ડથી લોગીન કરી શકો છો.');
      setResetStep(1);
      setResetOtp('');
      setNewPassword('');
      setIsForgotPassword(false);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'કોડ ખોટો છે અથવા એક્સપાયર થઈ ગયો છે. ફરી પ્રયત્ન કરો.');
    } finally {
      setLoading(false);
    }
  };

  const handleAuth = async () => {
    if (isForgotPassword) {
      if (resetStep === 1) {
        await handleSendRecoveryOtp();
      } else {
        await handleVerifyOtpAndSetPassword();
      }
      return;
    }

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

          <Text style={styles.subtitle}>
            {isForgotPassword 
              ? (resetStep === 1 ? 'પાસવર્ડ રીસેટ - OTP મેળવો' : 'નવો પાસવર્ડ સેટ કરો') 
              : isSignUp 
                ? 'નવું એકાઉન્ટ બનાવો' 
                : 'ખાતામાં પ્રવેશ કરો'}
          </Text>

          {error ? <Text style={styles.error}>{error}</Text> : null}
          {message ? <Text style={styles.success}>{message}</Text> : null}

          {/* Email field (disabled in step 2 of reset so user doesn't accidentally change email) */}
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
            disabled={loading || (isForgotPassword && resetStep === 2)}
            outlineColor="#bdbdbd"
            activeOutlineColor="#1a73e8"
            left={<TextInput.Icon icon="email-outline" />}
          />

          {/* Normal Login/Signup Password Field */}
          {!isForgotPassword && (
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
          )}

          {/* Forgot Password Step 2: OTP Token & New Password Inputs */}
          {isForgotPassword && resetStep === 2 && (
            <>
              <TextInput
                label="ઇમેઇલ પર આવેલ ૬ અંકનો કોડ (OTP)"
                value={resetOtp}
                onChangeText={setResetOtp}
                mode="outlined"
                keyboardType="number-pad"
                placeholder="દા.ત. 123456"
                style={styles.input}
                disabled={loading}
                outlineColor="#bdbdbd"
                activeOutlineColor="#1a73e8"
                left={<TextInput.Icon icon="shield-key-outline" />}
              />
              <TextInput
                label="નવો પાસવર્ડ (New Password)"
                value={newPassword}
                onChangeText={setNewPassword}
                mode="outlined"
                secureTextEntry
                placeholder="ઓછામાં ઓછા ૬ અક્ષર"
                style={styles.input}
                disabled={loading}
                outlineColor="#bdbdbd"
                activeOutlineColor="#1a73e8"
                left={<TextInput.Icon icon="lock-reset" />}
              />
            </>
          )}

          {!isForgotPassword && !isSignUp && (
            <Button
              mode="text"
              onPress={() => {
                setIsForgotPassword(true);
                setResetStep(1);
                setResetOtp('');
                setNewPassword('');
                setError('');
                setMessage('');
              }}
              disabled={loading}
              textColor="#d32f2f"
              style={styles.forgotBtn}
              labelStyle={styles.forgotBtnLabel}
            >
              પાસવર્ડ ભૂલી ગયા છો? (Forgot Password?)
            </Button>
          )}

          <Button
            mode="contained"
            onPress={handleAuth}
            loading={loading}
            disabled={loading}
            style={styles.button}
            contentStyle={styles.buttonContent}
            buttonColor="#1a73e8"
          >
            {isForgotPassword
              ? (resetStep === 1 ? 'OTP કોડ મોકલો (Send OTP)' : 'પાસવર્ડ બદલો (Update Password)')
              : isSignUp
                ? 'નોંધણી કરો (Sign Up)'
                : 'પ્રવેશ કરો (Login)'}
          </Button>

          {isForgotPassword ? (
            <View style={styles.forgotNavRow}>
              {resetStep === 2 && (
                <Button
                  mode="text"
                  onPress={() => {
                    setResetStep(1);
                    setError('');
                    setMessage('');
                  }}
                  disabled={loading}
                  textColor="#7f8c8d"
                  style={styles.toggleButton}
                >
                  ફરી OTP મોકલો (Resend OTP)
                </Button>
              )}
              <Button
                mode="text"
                onPress={() => {
                  setIsForgotPassword(false);
                  setResetStep(1);
                  setResetOtp('');
                  setNewPassword('');
                  setError('');
                  setMessage('');
                }}
                disabled={loading}
                textColor="#1a73e8"
                style={styles.toggleButton}
              >
                પાછા લોગીન પર જાઓ (Back to Login)
              </Button>
            </View>
          ) : (
            <Button
              mode="text"
              onPress={() => {
                setIsSignUp(!isSignUp);
                setError('');
                setMessage('');
              }}
              disabled={loading}
              textColor="#1a73e8"
              style={styles.toggleButton}
            >
              {isSignUp ? 'પહેલેથી એકાઉન્ટ છે? લોગીન કરો' : 'નવું એકાઉન્ટ બનાવવું છે? સાઇન અપ કરો'}
            </Button>
          )}

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
  forgotBtn: {
    alignSelf: 'flex-end',
    marginTop: -8,
    marginBottom: 8,
  },
  forgotBtnLabel: {
    fontSize: 12,
  },
  toggleButton: {
    marginTop: 15,
  },
  forgotNavRow: {
    alignItems: 'center',
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
