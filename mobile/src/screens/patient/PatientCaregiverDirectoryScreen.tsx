import React, {useEffect, useState} from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import FeatherIcons from 'react-native-vector-icons/Feather';

import {apiClient, getErrorMessage} from '../../api/client';
import {colors} from '../../constants/colors';
import type {
  CaregiverContact,
  PatientRelationshipGroup,
  RelationshipMember,
} from '../../types/models';

const aislaLogo = require('../../assets/aisla-logo.png');
const avatarTones = [
  {background: '#E7F8FF', border: '#91D7F2', text: '#178CC7'},
  {background: '#F2F8E9', border: '#BEE28D', text: '#5F9A1D'},
  {background: '#FFF2EC', border: '#F3C39D', text: '#D96D29'},
  {background: '#F8EDFF', border: '#D7B8F7', text: '#8B52C9'},
] as const;

type PatientCaregiverDirectoryScreenProps = {
  onBack: () => void;
  onSelectCaregiver: (caregiver: CaregiverContact) => void;
};

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);

  if (parts.length === 0) {
    return 'CG';
  }

  return parts
    .slice(0, 2)
    .map(part => part[0]?.toUpperCase() ?? '')
    .join('');
}

function extractCaregivers(
  relationships: PatientRelationshipGroup[],
): CaregiverContact[] {
  const caregivers = new Map<string, CaregiverContact>();

  relationships.forEach(relationship => {
    const caregiver = relationship.caregiver as RelationshipMember | undefined;

    if (!caregiver?._id) {
      return;
    }

    caregivers.set(caregiver._id, {
      id: caregiver._id,
      name: caregiver.full_name || 'Caregiver',
      email: caregiver.email || '',
    });
  });

  return [...caregivers.values()];
}

function CaregiverCard({
  caregiver,
  highlighted,
  index,
  onPress,
}: {
  caregiver: CaregiverContact;
  highlighted?: boolean;
  index: number;
  onPress: () => void;
}): React.JSX.Element {
  const tone = avatarTones[index % avatarTones.length];

  return (
    <Pressable
      accessibilityLabel={`Open chat with ${caregiver.name}`}
      accessibilityRole="button"
      onPress={onPress}
      style={({pressed}) => [
        styles.caregiverCard,
        highlighted ? styles.caregiverCardPrimary : null,
        pressed ? styles.pressed : null,
      ]}>
      <View style={styles.caregiverCardMain}>
        <View
          style={[
            styles.avatarWrap,
            {
              backgroundColor: tone.background,
              borderColor: highlighted ? '#56D4C8' : tone.border,
            },
          ]}>
          <Text style={[styles.avatarText, {color: tone.text}]}>
            {getInitials(caregiver.name)}
          </Text>
          <View style={styles.avatarOnlineDot} />
        </View>

        <View style={styles.caregiverCopy}>
          <Text numberOfLines={1} style={styles.caregiverName}>
            {caregiver.name}
          </Text>
          <Text style={styles.caregiverRole}>Caregiver</Text>
          {caregiver.email ? (
            <Text numberOfLines={1} style={styles.caregiverEmail}>
              {caregiver.email}
            </Text>
          ) : null}
        </View>
      </View>

      <View style={styles.chatActionButton}>
        <FeatherIcons color="#1AB9B3" name="message-circle" size={24} />
      </View>
    </Pressable>
  );
}

export function PatientCaregiverDirectoryScreen({
  onBack,
  onSelectCaregiver,
}: PatientCaregiverDirectoryScreenProps): React.JSX.Element {
  const [caregivers, setCaregivers] = useState<CaregiverContact[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const loadCaregivers = async () => {
      setIsLoading(true);
      setError('');

      try {
        const relationships = await apiClient.getRelationships();
        setCaregivers(extractCaregivers(relationships));
      } catch (nextError) {
        setCaregivers([]);
        setError(getErrorMessage(nextError));
      } finally {
        setIsLoading(false);
      }
    };

    loadCaregivers().catch(() => undefined);
  }, []);

  const primaryCaregiver = caregivers[0] ?? null;
  const otherCaregivers = caregivers.slice(1);

  const renderBody = () => {
    if (isLoading) {
      return (
        <View style={styles.statePanel}>
          <ActivityIndicator color={colors.primary} size="small" />
          <Text style={styles.stateTitle}>Loading caregivers...</Text>
          <Text style={styles.stateBody}>
            Fetching your caregiver contacts before opening chat.
          </Text>
        </View>
      );
    }

    if (error) {
      return (
        <View style={styles.statePanel}>
          <Text style={styles.stateTitle}>Unable to load caregivers</Text>
          <Text style={styles.stateBody}>{error}</Text>
        </View>
      );
    }

    if (!primaryCaregiver) {
      return (
        <View style={styles.statePanel}>
          <Image resizeMode="contain" source={aislaLogo} style={styles.emptyLogo} />
          <Text style={styles.stateTitle}>No caregivers connected yet</Text>
          <Text style={styles.stateBody}>
            Once a caregiver is assigned, you can choose them here before
            starting a chat.
          </Text>
        </View>
      );
    }

    return (
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}>
        <View style={styles.sectionBlock}>
          <Text style={styles.sectionTitle}>My Caregiver</Text>
          <CaregiverCard
            caregiver={primaryCaregiver}
            highlighted
            index={0}
            onPress={() => onSelectCaregiver(primaryCaregiver)}
          />
        </View>

        {otherCaregivers.length > 0 ? (
          <View style={styles.sectionBlock}>
            <Text style={styles.sectionTitle}>Other Caregivers</Text>
            <View style={styles.cardList}>
              {otherCaregivers.map((caregiver, index) => (
                <CaregiverCard
                  key={caregiver.id}
                  caregiver={caregiver}
                  index={index + 1}
                  onPress={() => onSelectCaregiver(caregiver)}
                />
              ))}
            </View>
          </View>
        ) : null}
      </ScrollView>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.topBar}>
        <Pressable
          accessibilityLabel="Back to home"
          accessibilityRole="button"
          onPress={onBack}
          style={({pressed}) => [
            styles.backButton,
            pressed ? styles.pressed : null,
          ]}>
          <FeatherIcons color={colors.text} name="arrow-left" size={20} />
        </Pressable>

        <Text style={styles.topBarTitle}>Chat with Caregiver</Text>

        <View style={styles.logoBadge}>
          <Image resizeMode="contain" source={aislaLogo} style={styles.logoImage} />
        </View>
      </View>

      {renderBody()}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F7FBFF',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 18,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.shadow,
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: {width: 0, height: 4},
    elevation: 3,
  },
  topBarTitle: {
    flex: 1,
    textAlign: 'center',
    marginHorizontal: 16,
    fontFamily: 'Poppins-ExtraBold',
    fontSize: 24,
    color: '#183A5A',
    letterSpacing: -0.6,
  },
  logoBadge: {
    width: 44,
    height: 44,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.shadow,
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: {width: 0, height: 4},
    elevation: 3,
  },
  logoImage: {
    width: 28,
    height: 28,
  },
  content: {
    paddingHorizontal: 20,
    paddingBottom: 28,
    gap: 28,
  },
  sectionBlock: {
    gap: 14,
  },
  sectionTitle: {
    fontFamily: 'Poppins-Bold',
    fontSize: 16,
    color: '#183A5A',
  },
  cardList: {
    gap: 16,
  },
  caregiverCard: {
    minHeight: 116,
    borderRadius: 26,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5EDF5',
    paddingHorizontal: 18,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
    shadowColor: '#CBD8E5',
    shadowOpacity: 0.12,
    shadowRadius: 14,
    shadowOffset: {width: 0, height: 6},
    elevation: 3,
  },
  caregiverCardPrimary: {
    backgroundColor: '#F2F8FF',
    borderColor: '#D4EDF0',
  },
  caregiverCardMain: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  avatarWrap: {
    width: 78,
    height: 78,
    borderRadius: 39,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  avatarText: {
    fontFamily: 'Poppins-ExtraBold',
    fontSize: 24,
  },
  avatarOnlineDot: {
    position: 'absolute',
    right: 6,
    bottom: 6,
    width: 14,
    height: 14,
    borderRadius: 999,
    backgroundColor: colors.success,
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  caregiverCopy: {
    flex: 1,
    gap: 2,
  },
  caregiverName: {
    fontFamily: 'Poppins-ExtraBold',
    fontSize: 24,
    color: '#1B2F48',
    letterSpacing: -0.5,
  },
  caregiverRole: {
    fontFamily: 'Poppins-Bold',
    fontSize: 16,
    color: '#2F4A62',
  },
  caregiverEmail: {
    fontSize: 13,
    color: '#6C8094',
  },
  chatActionButton: {
    width: 72,
    height: 72,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#E5EDF5',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statePanel: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
    gap: 10,
  },
  stateTitle: {
    fontFamily: 'Poppins-Bold',
    fontSize: 22,
    color: '#17375A',
    textAlign: 'center',
  },
  stateBody: {
    fontSize: 15,
    lineHeight: 24,
    color: '#617A90',
    textAlign: 'center',
  },
  emptyLogo: {
    width: 64,
    height: 64,
    opacity: 0.92,
  },
  pressed: {
    opacity: 0.82,
  },
});
