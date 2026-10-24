import React, { useEffect, useState } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, ActivityIndicator, StatusBar, Platform } from 'react-native';
import { Provider as PaperProvider, MD3LightTheme } from 'react-native-paper';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';

// Import Screens
import SetupScreen from './src/screens/SetupScreen';
import LoginScreen from './src/screens/LoginScreen';
import BookListScreen from './src/screens/BookListScreen';
import CashbookScreen from './src/screens/CashbookScreen';
import DepartmentsScreen from './src/screens/DepartmentsScreen';
import SettingsScreen from './src/screens/SettingsScreen';

// Import Utilities
import { autoInitSupabase, isSupabaseConfigured, clearSupabaseConfig, getSupabase } from './src/utils/supabase';
import { performAutoBackupCheck } from './src/utils/backup';
import { Book } from './src/types';

// Design Theme
const theme = {
  ...MD3LightTheme,
  colors: {
    ...MD3LightTheme.colors,
    primary: '#1976d2',
    secondary: '#4caf50',
    background: '#f5f5f5',
  },
};

type Screen = 'loading' | 'setup' | 'login' | 'books' | 'main';
type Tab = 'cashbook' | 'departments' | 'settings';

export default function App() {
  const [currentScreen, setCurrentScreen] = useState<Screen>('loading');
  const [currentTab, setCurrentTab] = useState<Tab>('cashbook');
  const [selectedBook, setSelectedBook] = useState<Book | null>(null);

  const checkAppConfig = async () => {
    const configured = await isSupabaseConfigured();
    if (!configured) {
      setCurrentScreen('setup');
      return;
    }

    const initialized = await autoInitSupabase();
    if (!initialized) {
      setCurrentScreen('setup');
      return;
    }

    // Check user auth session
    try {
      const supabase = getSupabase();
      const { data: { session } } = await supabase.auth.getSession();
      
      if (session) {
        setCurrentScreen('books');
      } else {
        setCurrentScreen('login');
      }
    } catch (error) {
      console.error(error);
      setCurrentScreen('login');
    }
  };

  useEffect(() => {
    let subscription: any = null;

    const initAuthListener = async () => {
      await checkAppConfig();
      try {
        const configured = await isSupabaseConfigured();
        if (configured) {
          const supabase = getSupabase();
          const { data } = supabase.auth.onAuthStateChange((event, session) => {
            if (event === 'SIGNED_OUT' || !session) {
              setCurrentScreen('login');
              setSelectedBook(null);
            } else if (session) {
              // Automatically open list of all books whenever user is logged in
              setCurrentScreen((prev) => (prev === 'loading' || prev === 'login' || prev === 'setup' ? 'books' : prev));
              // Trigger 2x daily automated backup check
              performAutoBackupCheck();
            }
          });
          subscription = data.subscription;
        }
      } catch (e) {
        // Ignored if client is not initialized yet
      }
    };

    initAuthListener();

    return () => {
      if (subscription) {
        subscription.unsubscribe();
      }
    };
  }, []);

  const handleLogout = async () => {
    try {
      const supabase = getSupabase();
      await supabase.auth.signOut();
    } catch (error) {
      console.error(error);
    }
    setCurrentScreen('login');
    setSelectedBook(null);
  };

  const handleResetConnection = async () => {
    await clearSupabaseConfig();
    setCurrentScreen('setup');
    setSelectedBook(null);
  };

  // Rendering Helper
  if (currentScreen === 'loading') {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#1976d2" />
        <Text style={styles.loadingText}>એપ્લિકેશન શરૂ થઈ રહી છે...</Text>
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <PaperProvider theme={theme}>
        <SafeAreaView style={styles.container} edges={['top', 'bottom', 'left', 'right']}>
          <StatusBar barStyle="light-content" backgroundColor="#1976d2" translucent={false} />

          {/* Setup Connection Flow */}
          {currentScreen === 'setup' && (
            <SetupScreen onSetupComplete={checkAppConfig} />
          )}

          {/* Authentication Flow */}
          {currentScreen === 'login' && (
            <LoginScreen
              onLoginSuccess={() => setCurrentScreen('books')}
              onChangeConnection={handleResetConnection}
            />
          )}

          {/* Book Selection Flow */}
          {currentScreen === 'books' && (
            <BookListScreen
              onSelectBook={(book) => {
                setSelectedBook(book);
                setCurrentScreen('main');
                setCurrentTab('cashbook');
              }}
              onLogout={handleLogout}
            />
          )}

          {/* Main App Screens */}
          {currentScreen === 'main' && selectedBook && (
            <View style={styles.mainContainer}>
              {/* Active Tab Screen */}
              <View style={styles.content}>
                {currentTab === 'cashbook' && (
                  <CashbookScreen book={selectedBook} />
                )}

                {currentTab === 'departments' && (
                  <DepartmentsScreen book={selectedBook} />
                )}

                {currentTab === 'settings' && (
                  <SettingsScreen
                    book={selectedBook}
                    onBackToBooks={() => {
                      setSelectedBook(null);
                      setCurrentScreen('books');
                    }}
                    onLogout={handleLogout}
                    onResetConnection={handleResetConnection}
                  />
                )}
              </View>

              {/* Bottom Navigation Tabs */}
              <View style={styles.tabBar}>
                <TouchableOpacity
                  style={styles.tabItem}
                  onPress={() => setCurrentTab('cashbook')}
                >
                  <MaterialCommunityIcons
                    name="wallet"
                    size={24}
                    color={currentTab === 'cashbook' ? '#1976d2' : '#757575'}
                  />
                  <Text
                    style={[
                      styles.tabLabel,
                      { color: currentTab === 'cashbook' ? '#1976d2' : '#757575' },
                    ]}
                  >
                    કેશબુક
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.tabItem}
                  onPress={() => setCurrentTab('departments')}
                >
                  <MaterialCommunityIcons
                    name="domain"
                    size={24}
                    color={currentTab === 'departments' ? '#1976d2' : '#757575'}
                  />
                  <Text
                    style={[
                      styles.tabLabel,
                      { color: currentTab === 'departments' ? '#1976d2' : '#757575' },
                    ]}
                  >
                    વિભાગો
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.tabItem}
                  onPress={() => {
                    setSelectedBook(null);
                    setCurrentScreen('books');
                  }}
                >
                  <MaterialCommunityIcons
                    name="book-sync"
                    size={24}
                    color="#757575"
                  />
                  <Text style={[styles.tabLabel, { color: '#757575' }]}>
                    ચોપડો બદલો
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.tabItem}
                  onPress={() => setCurrentTab('settings')}
                >
                  <MaterialCommunityIcons
                    name="cog"
                    size={24}
                    color={currentTab === 'settings' ? '#1976d2' : '#757575'}
                  />
                  <Text
                    style={[
                      styles.tabLabel,
                      { color: currentTab === 'settings' ? '#1976d2' : '#757575' },
                    ]}
                  >
                    સેટિંગ્સ
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </SafeAreaView>
      </PaperProvider>
    </SafeAreaProvider>
  );
}


const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1976d2', // Match StatusBar background
  },
  mainContainer: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  content: {
    flex: 1,
  },
  tabBar: {
    height: 56,
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    elevation: 8,
  },
  tabItem: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: 'bold',
    marginTop: 2,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  loadingText: {
    marginTop: 15,
    fontSize: 16,
    color: '#666',
    fontWeight: 'bold',
  },
});
