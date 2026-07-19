import React, { useState } from 'react';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Screen } from '../../components/Screen';
import { SegmentedControl } from '../../components/UI';
import { CreateBandForm } from './CreateBandScreen';
import { JoinBandForm } from './JoinBandScreen';
import { BandsStackParamList } from '../../types/navigation';

type Props = NativeStackScreenProps<BandsStackParamList, 'BandAdd'>;
type BandAddTab = 'create' | 'invite';

export function BandAddScreen({ navigation }: Props) {
  const [activeTab, setActiveTab] = useState<BandAddTab>('create');

  return (
    <Screen>
      <SegmentedControl
        value={activeTab}
        onChange={setActiveTab}
        options={[
          { value: 'create', label: '밴드 만들기' },
          { value: 'invite', label: '초대코드 입력' },
        ]}
      />
      {activeTab === 'create' ? <CreateBandForm onComplete={() => navigation.popToTop()} /> : null}
      {activeTab === 'invite' ? <JoinBandForm onComplete={() => navigation.popToTop()} /> : null}
    </Screen>
  );
}
