import React, { useState } from 'react';
import { StyleSheet, View, ScrollView } from 'react-native';
import { Button, Card, Text, TextInput } from 'react-native-paper';
import { initSupabase } from '../utils/supabase';

interface SetupScreenProps {
  onSetupComplete: () => void;
}

export default function SetupScreen({ onSetupComplete }: SetupScreenProps) {
  const [url, setUrl] = useState('');
  const [key, setKey] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSave = async () => {
    if (!url || !key) {
      setError('કૃપા કરીને બંને ખાના ભરો.');
      return;
    }
    setError('');
    setLoading(true);
    const success = await initSupabase(url.trim(), key.trim());
    setLoading(false);
    if (success) {
      onSetupComplete();
    } else {
      setError('જોડાણ નિષ્ફળ રહ્યું. URL અથવા Anon Key તપાસો.');
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Card style={styles.card}>
        <Card.Content>
          <Text style={styles.title}>ડિજિટલ ખાતા બુક</Text>
          <Text style={styles.subtitle}>Supabase કનેક્ટ કરો</Text>
          
          <Text style={styles.info}>
            આ એપને ચલાવવા માટે તમારા ફ્રી Supabase પ્રોજેક્ટની કનેક્શન વિગત આપો. આ માહિતી તમારા ફોનમાં સુરક્ષિત સંગ્રહિત રહેશે.
          </Text>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <TextInput
            label="Supabase પ્રોજેક્ટ URL"
            value={url}
            onChangeText={setUrl}
            mode="outlined"
            placeholder="https://xxxx.supabase.co"
            style={styles.input}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            disabled={loading}
          />

          <TextInput
            label="Supabase Anon Key (API Key)"
            value={key}
            onChangeText={setKey}
            mode="outlined"
            placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
            style={styles.input}
            multiline
            numberOfLines={3}
            autoCapitalize="none"
            autoCorrect={false}
            disabled={loading}
          />

          <Button
            mode="contained"
            onPress={handleSave}
            loading={loading}
            disabled={loading}
            style={styles.button}
            contentStyle={styles.buttonContent}
          >
            સેવ કરો અને આગળ વધો
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
    backgroundColor: '#f5f5f5',
  },
  card: {
    padding: 10,
    elevation: 4,
    borderRadius: 12,
    backgroundColor: '#ffffff',
  },
  title: {
    fontSize: 26,
    fontWeight: 'bold',
    color: '#1976d2',
    textAlign: 'center',
    marginBottom: 5,
  },
  subtitle: {
    fontSize: 18,
    color: '#555',
    textAlign: 'center',
    marginBottom: 20,
  },
  info: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
    marginBottom: 20,
    backgroundColor: '#e3f2fd',
    padding: 10,
    borderRadius: 8,
  },
  input: {
    marginBottom: 15,
  },
  button: {
    marginTop: 10,
    backgroundColor: '#1976d2',
  },
  buttonContent: {
    paddingVertical: 6,
  },
  error: {
    color: '#d32f2f',
    marginBottom: 15,
    textAlign: 'center',
    fontWeight: 'bold',
  },
});
