import React, {useMemo, useState} from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import {getErrorMessage} from '../../api/client';

type CompleteInviteValues = {
  fullName: string;
  newPassword: string;
  phoneCountry: string;
  phoneNumber: string;
  address: string;
};

type CompleteInviteScreenProps = {
  initialFullName?: string;
  initialPhoneCountry?: string | null;
  initialPhoneNumber?: string | null;
  onSubmit: (values: CompleteInviteValues) => Promise<void> | void;
};

export function CompleteInviteScreen({
  initialFullName,
  initialPhoneCountry,
  initialPhoneNumber,
  onSubmit,
}: CompleteInviteScreenProps): React.JSX.Element {
  const [fullName, setFullName] = useState(initialFullName ?? '');
  const [newPassword, setNewPassword] = useState('');
  const [phoneCountry, setPhoneCountry] = useState(initialPhoneCountry ?? '44');
  const [phoneNumber, setPhoneNumber] = useState(initialPhoneNumber ?? '');
  const [address, setAddress] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const canSubmit = useMemo(() => {
    return fullName.trim().length > 1 && newPassword.trim().length >= 6;
  }, [fullName, newPassword]);

  const handleSubmit = async () => {
    if (!canSubmit || isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    setErrorMessage('');

    try {
      await onSubmit({
        fullName: fullName.trim(),
        newPassword: newPassword.trim(),
        phoneCountry: phoneCountry.trim(),
        phoneNumber: phoneNumber.trim(),
        address: address.trim(),
      });
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      style={styles.keyboardView}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled">
          <View style={styles.copyBlock}>
            <Text style={styles.title}>Complete your account</Text>
            <Text style={styles.subtitle}>
              Finish your invited profile to continue into AISLA Care.
            </Text>
          </View>

          <View style={styles.formCard}>
            <View style={styles.field}>
              <Text style={styles.label}>Full name</Text>
              <TextInput
                onChangeText={setFullName}
                placeholder="Full name"
                placeholderTextColor="#B8B8C7"
                style={styles.input}
                value={fullName}
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>New password</Text>
              <TextInput
                onChangeText={setNewPassword}
                placeholder="Minimum 6 characters"
                placeholderTextColor="#B8B8C7"
                secureTextEntry
                style={styles.input}
                value={newPassword}
              />
            </View>

            <View style={styles.rowField}>
              <View style={styles.countryField}>
                <Text style={styles.label}>Country code</Text>
                <TextInput
                  keyboardType="phone-pad"
                  onChangeText={setPhoneCountry}
                  placeholder="44"
                  placeholderTextColor="#B8B8C7"
                  style={styles.input}
                  value={phoneCountry}
                />
              </View>
              <View style={styles.phoneField}>
                <Text style={styles.label}>Phone number</Text>
                <TextInput
                  keyboardType="phone-pad"
                  onChangeText={setPhoneNumber}
                  placeholder="Phone number"
                  placeholderTextColor="#B8B8C7"
                  style={styles.input}
                  value={phoneNumber}
                />
              </View>
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Address</Text>
              <TextInput
                onChangeText={setAddress}
                placeholder="Address"
                placeholderTextColor="#B8B8C7"
                style={styles.input}
                value={address}
              />
            </View>

            <Pressable
              disabled={!canSubmit || isSubmitting}
              onPress={() => {
                handleSubmit().catch(() => undefined);
              }}
              style={({pressed}) => [
                styles.primaryButton,
                !canSubmit || isSubmitting ? styles.primaryButtonDisabled : null,
                pressed ? styles.pressed : null,
              ]}>
              <Text style={styles.primaryButtonText}>
                {isSubmitting ? 'Saving...' : 'Save and Continue'}
              </Text>
            </Pressable>

            {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}
          </View>
        </ScrollView>
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  keyboardView: {
    flex: 1,
    backgroundColor: '#F8FBFD',
  },
  safeArea: {
    flex: 1,
    backgroundColor: '#F8FBFD',
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: 30,
    paddingTop: 30,
    paddingBottom: 40,
  },
  copyBlock: {
    marginBottom: 30,
  },
  title: {
    fontFamily: 'Poppins-Bold',
    color: '#17375A',
    fontSize: 24,
    lineHeight: 32,
  },
  subtitle: {
    color: '#6A7E8F',
    fontSize: 15,
    lineHeight: 24,
  },
  formCard: {
    gap: 14,
  },
  field: {
    gap: 4,
  },
  rowField: {
    flexDirection: 'row',
    gap: 8,
  },
  countryField: {
    width: 100,
    gap: 4,
  },
  phoneField: {
    flex: 1,
    gap: 4,
  },
  label: {
    fontFamily: 'Poppins-SemiBold',
    fontSize: 14,
    color: '#17375A',
  },
  input: {
    height: 52,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#D8ECFA',
    backgroundColor: '#F4FBFF',
    paddingHorizontal: 16,
    fontSize: 16,
    color: '#000000',
  },
  primaryButton: {
    minHeight: 52,
    borderRadius: 999,
    backgroundColor: '#177BC8',
    marginTop: 8,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  primaryButtonDisabled: {
    opacity: 0.65,
  },
  primaryButtonText: {
    fontFamily: 'Poppins-Bold',
    fontSize: 15,
    color: '#FFFFFF',
  },
  errorText: {
    color: '#D93E32',
    fontSize: 14,
    lineHeight: 20,
  },
  pressed: {
    opacity: 0.84,
  },
});
