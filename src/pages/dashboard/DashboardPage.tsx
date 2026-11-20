import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { DashboardLayout, type DashboardSectionId } from '../../components/layout/DashboardLayout';
import { OverviewSection } from './OverviewSection';
import { AgentsSection } from './AgentsSection';
import { KnowledgeBasesSection } from './KnowledgeBasesSection';
import { DocumentsSection } from './DocumentsSection';
import { ConversationsSection } from './ConversationsSection';
import { ChatbotDeploymentSection } from './ChatbotDeploymentSection';
import { LeadsSection } from './LeadsSection';
import { WorkflowsSection } from './WorkflowsSection';
import { IntegrationsSection } from './IntegrationsSection';
import { AnalyticsSection } from './AnalyticsSection';
import { BillingSection } from './BillingSection';
import { NotificationsSection } from './NotificationsSection';
import { MembersSection } from './MembersSection';
import { SettingsSection } from './SettingsSection';
import { AuditSection } from './AuditSection';

const VALID_SECTIONS: Set<string> = new Set([
  'overview',
  'agents',
  'knowledge',
  'documents',
  'conversations',
  'deployment',
  'leads',
  'workflows',
  'integrations',
  'analytics',
  'billing',
  'notifications',
  'members',
  'settings',
  'audit',
]);

export const DashboardPage: React.FC<{ initialSection?: DashboardSectionId }> = ({
  initialSection = 'overview',
}) => {
  const [searchParams] = useSearchParams();
  const requestedSection = searchParams.get('section');
  const resolvedInitial =
    requestedSection && VALID_SECTIONS.has(requestedSection)
      ? (requestedSection as DashboardSectionId)
      : initialSection;
  const [section, setSection] = useState<DashboardSectionId>(resolvedInitial);

  useEffect(() => {
    if (requestedSection && VALID_SECTIONS.has(requestedSection)) {
      setSection(requestedSection as DashboardSectionId);
    }
  }, [requestedSection]);

  const renderSection = () => {
    switch (section) {
      case 'overview':
        return <OverviewSection onNavigate={(s) => setSection(s as DashboardSectionId)} />;
      case 'agents':
        return <AgentsSection />;
      case 'knowledge':
        return <KnowledgeBasesSection />;
      case 'documents':
        return <DocumentsSection />;
      case 'conversations':
        return <ConversationsSection />;
      case 'deployment':
        return <ChatbotDeploymentSection />;
      case 'leads':
        return <LeadsSection />;
      case 'workflows':
        return <WorkflowsSection />;
      case 'integrations':
        return <IntegrationsSection />;
      case 'analytics':
        return <AnalyticsSection />;
      case 'billing':
        return <BillingSection />;
      case 'notifications':
        return <NotificationsSection />;
      case 'members':
        return <MembersSection />;
      case 'settings':
        return <SettingsSection />;
      case 'audit':
        return <AuditSection />;
      default:
        return <OverviewSection onNavigate={(s) => setSection(s as DashboardSectionId)} />;
    }
  };

  return (
    <DashboardLayout activeSection={section} onSelectSection={setSection}>
      {renderSection()}
    </DashboardLayout>
  );
};
