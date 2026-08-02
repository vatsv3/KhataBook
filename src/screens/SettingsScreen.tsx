import React, { useEffect, useState } from 'react';
import { StyleSheet, View, Alert, FlatList } from 'react-native';
import { Button, Card, Text, TextInput, Divider, List, IconButton, Portal, Dialog } from 'react-native-paper';
import { getSupabase, hasHardcodedConfig } from '../utils/supabase';
import { Book } from '../types';

interface SettingsScreenProps {
  book: Book;
  onBackToBooks: () => void;
  onLogout: () => void;
  onResetConnection: () => void;
}

export default function SettingsScreen({ book, onBackToBooks, onLogout, onResetConnection }: SettingsScreenProps) {
  const [userEmail, setUserEmail] = useState('');
  const [collaborators, setCollaborators] = useState<any[]>([]);
  const [collabEmail, setCollabEmail] = useState('');
  const [isOwner, setIsOwner] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isHardcoded, setIsHardcoded] = useState(false);

  const supabase = getSupabase();

  const loadSettingsData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      
      setUserEmail(user.email || '');
      setIsOwner(book.created_by === user.id);

      // Fetch collaborators
      const { data, error } = await supabase
        .from('book_collaborators')
        .select('*')
        .eq('book_id', book.id);
      
      if (error) throw error;
      setCollaborators(data || []);
    } catch (error) {
      console.error('Error loading settings:', error);
    }
  };

  useEffect(() => {
    loadSettingsData();
    setIsHardcoded(hasHardcodedConfig());
  }, [book.id]);

  const handleAddCollaborator = async () => {
    if (!collabEmail.trim()) return;
    setLoading(true);
    try {
      const email = collabEmail.trim().toLowerCase();
      const { error } = await supabase
        .from('book_collaborators')
        .insert({
          book_id: book.id,
          user_email: email
        });

      if (error) {
        if (error.code === '23505') {
          Alert.alert('માહિતી', 'આ ભાગીદાર પહેલાથી ઉમેરાયેલ છે.');
        } else {
          throw error;
        }
        return;
      }

      setCollabEmail('');
      Alert.alert('સફળતા', 'ભાગીદાર સફળતાપૂર્વક ઉમેરાઈ ગયા.');
      loadSettingsData();
    } catch (error) {
      console.error(error);
      Alert.alert('ભૂલ', 'ભાગીદાર ઉમેરવામાં સમસ્યા આવી.');
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveCollaborator = async (collabId: string) => {
    Alert.alert(
      'ભાગીદાર દૂર કરો',
      'શું તમે ખરેખર આ ભાગીદારને આ ખાતા બુકમાંથી દૂર કરવા માંગો છો?',
      [
        { text: 'ના', style: 'cancel' },
        {
          text: 'હા, દૂર કરો',
          onPress: async () => {
            try {
              const { error } = await supabase
                .from('book_collaborators')
                .delete()
                .eq('id', collabId);
              
              if (error) throw error;
              Alert.alert('સફળતા', 'ભાગીદાર દૂર થઈ ગયા.');
              loadSettingsData();
            } catch (error) {
              console.error(error);
              Alert.alert('ભૂલ', 'ભાગીદાર દૂર કરવામાં સમસ્યા આવી.');
            }
          }
        }
      ]
    );
  };

  return (
    <View style={styles.container}>
      {/* Profile Card */}
      <Card style={styles.card}>
        <Card.Content>
          <Text style={styles.cardTitle}>વપરાશકર્તા વિગત</Text>
          <Text style={styles.emailText}>📧 ઇમેઇલ: {userEmail}</Text>
          <Text style={styles.bookInfoText}>📖 ચાલુ ખાતા બુક: {book.name}</Text>
          <Text style={styles.bookRoleText}>
            👤 રોલ: {isOwner ? 'માલિક (Owner)' : 'ભાગીદાર (Collaborator)'}
          </Text>
        </Card.Content>
      </Card>

      {/* Collaborator Section */}
      <Card style={styles.card}>
        <Card.Content>
          <Text style={styles.cardTitle}>હિસાબ ભાગીદારો (Collaboration)</Text>
          <Text style={styles.infoText}>
            આ ખાતા બુકમાં સભ્ય તરીકે જોડવા માટે તેમનો ઇમેઇલ ઉમેરો.
          </Text>

          {isOwner ? (
            <View style={styles.addCollabRow}>
              <TextInput
                label="ભાગીદારનો ઇમેઇલ"
                value={collabEmail}
                onChangeText={setCollabEmail}
                placeholder="partner@email.com"
                mode="outlined"
                keyboardType="email-address"
                autoCapitalize="none"
                style={styles.collabInput}
                dense
                disabled={loading}
              />
              <Button 
                mode="contained" 
                onPress={handleAddCollaborator} 
                style={styles.addBtn}
                loading={loading}
                disabled={loading}
              >
                ઉમેરો
              </Button>
            </View>
          ) : (
            <Text style={styles.collaboratorWarning}>
              ⚠️ ફક્ત ખાતા બુકના માલિક જ ભાગીદારોને ઉમેરી અથવા દૂર કરી શકે છે.
            </Text>
          )}

          <Divider style={styles.divider} />

          <Text style={styles.subTitle}>ચાલુ ભાગીદારો:</Text>
          {collaborators.length === 0 ? (
            <Text style={styles.noCollabText}>હજુ સુધી કોઈ ભાગીદાર ઉમેરેલ નથી.</Text>
          ) : (
            <FlatList
              data={collaborators}
              keyExtractor={(item) => item.id}
              scrollEnabled={false}
              renderItem={({ item }) => (
                <View style={styles.collabItem}>
                  <Text style={styles.collabEmail}>{item.user_email}</Text>
                  {isOwner && (
                    <IconButton
                      icon="trash-can-outline"
                      iconColor="#d32f2f"
                      size={20}
                      onPress={() => handleRemoveCollaborator(item.id)}
                    />
                  )}
                </View>
              )}
            />
          )}
        </Card.Content>
      </Card>

      {/* Actions */}
      <Card style={styles.card}>
        <Card.Content>
          <List.Item
            title="બીજી ખાતા બુક બદલો"
            description="ચાલુ બુક બંધ કરી લિસ્ટ પર જાઓ"
            left={(props) => <List.Icon {...props} icon="notebook-multiple" />}
            right={(props) => <IconButton {...props} icon="chevron-right" />}
            onPress={onBackToBooks}
            style={styles.listItem}
          />
          <Divider />
          <List.Item
            title="લોગઆઉટ (Sign Out)"
            description="એકાઉન્ટમાંથી બહાર નીકળો"
            left={(props) => <List.Icon {...props} icon="logout" />}
            right={(props) => <IconButton {...props} icon="chevron-right" />}
            onPress={onLogout}
            style={styles.listItem}
          />
          {!isHardcoded && (
            <>
              <Divider />
              <List.Item
                title="કનેક્શન રીસેટ કરો"
                description="Supabase સેટિંગ્સ સંપૂર્ણ દૂર કરો"
                left={(props) => <List.Icon {...props} icon="database-remove" color="#d32f2f" />}
                right={(props) => <IconButton {...props} icon="chevron-right" />}
                onPress={onResetConnection}
                style={styles.listItem}
              />
            </>
          )}
        </Card.Content>
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 12,
    backgroundColor: '#f5f5f5',
  },
  card: {
    marginBottom: 12,
    elevation: 2,
    borderRadius: 8,
    backgroundColor: '#ffffff',
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1976d2',
    marginBottom: 10,
  },
  subTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  emailText: {
    fontSize: 14,
    color: '#333',
    marginBottom: 6,
  },
  bookInfoText: {
    fontSize: 14,
    color: '#333',
    marginBottom: 6,
    fontWeight: 'bold',
  },
  bookRoleText: {
    fontSize: 14,
    color: '#666',
  },
  infoText: {
    fontSize: 12,
    color: '#666',
    marginBottom: 12,
  },
  addCollabRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  collabInput: {
    flex: 1,
    marginRight: 8,
  },
  addBtn: {
    backgroundColor: '#1976d2',
    height: 48,
    justifyContent: 'center',
  },
  collaboratorWarning: {
    fontSize: 12,
    color: '#c62828',
    backgroundColor: '#ffebee',
    padding: 8,
    borderRadius: 4,
    fontWeight: 'bold',
  },
  divider: {
    marginVertical: 12,
  },
  collabItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  collabEmail: {
    fontSize: 14,
    color: '#333',
  },
  noCollabText: {
    fontSize: 12,
    color: '#888',
    fontStyle: 'italic',
  },
  listItem: {
    paddingVertical: 4,
  },
});
