import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { GitlabCommonInterfacesService } from './gitlab-common-interfaces.service';
import { GitlabApiService } from './gitlab-api/gitlab-api.service';
import { IssueProviderService } from '../../issue-provider.service';
import { GitlabIssue } from './gitlab-issue.model';
import { Task } from '../../../tasks/task.model';

describe('GitlabCommonInterfacesService', () => {
  let service: GitlabCommonInterfacesService;
  let gitlabApiServiceSpy: jasmine.SpyObj<GitlabApiService>;
  let issueProviderServiceSpy: jasmine.SpyObj<IssueProviderService>;

  const mockGitlabCfg = {
    id: 'provider-1',
    isEnabled: true,
    project: 'test/project',
    filterUsername: '',
  };

  const mockGitlabIssue: GitlabIssue = {
    id: 'test/project#42',
    number: 42,
    title: 'Test issue',
    body: 'Test body',
    state: 'open',
    html_url: 'https://gitlab.com/test/project/-/issues/42',
    url: 'https://gitlab.com/test/project/-/issues/42',
    user: { login: 'testuser', id: 1, avatar_url: '', html_url: '' } as any,
    labels: [],
    assignee: null as any,
    milestone: null as any,
    closed_at: '',
    created_at: '2026-03-01T00:00:00Z',
    updated_at: '2026-03-12T00:00:00Z',
    due_date: '2026-04-01',
    wasUpdated: false,
    commentsNr: 0,
    comments: [],
    weight: undefined,
    links: { self: '', notes: '', award_emoji: '', project: '' },
  };

  beforeEach(() => {
    gitlabApiServiceSpy = jasmine.createSpyObj('GitlabApiService', [
      'getById$',
      'searchIssueInProject$',
      'getProjectIssues$',
    ]);
    issueProviderServiceSpy = jasmine.createSpyObj('IssueProviderService', [
      'getCfgOnce$',
    ]);

    TestBed.configureTestingModule({
      providers: [
        GitlabCommonInterfacesService,
        { provide: GitlabApiService, useValue: gitlabApiServiceSpy },
        { provide: IssueProviderService, useValue: issueProviderServiceSpy },
      ],
    });

    service = TestBed.inject(GitlabCommonInterfacesService);
  });

  describe('getAddTaskData', () => {
    it('should include dueDay from issue due_date for initial import', () => {
      const result = service.getAddTaskData(mockGitlabIssue);
      expect(result.dueDay).toBe('2026-04-01');
    });

    it('should set dueDay to undefined when issue has no due_date', () => {
      const issueWithoutDueDate = { ...mockGitlabIssue, due_date: undefined };
      const result = service.getAddTaskData(issueWithoutDueDate);
      expect(result.dueDay).toBeUndefined();
    });

    it('should set dueDay to undefined when due_date is empty string', () => {
      const issueWithEmptyDueDate = { ...mockGitlabIssue, due_date: '' };
      const result = service.getAddTaskData(issueWithEmptyDueDate);
      expect(result.dueDay).toBeUndefined();
    });
  });

  describe('getFreshDataForIssueTask', () => {
    const mockTask = {
      id: 'task-1',
      issueId: 'test/project#42',
      issueProviderId: 'provider-1',
      issueType: 'GITLAB',
      issueLastUpdated: new Date('2026-03-01T00:00:00Z').getTime(),
    } as Partial<Task> as Task;

    beforeEach(() => {
      issueProviderServiceSpy.getCfgOnce$.and.returnValue(of(mockGitlabCfg as any));
    });

    it('should NOT include dueDay in taskChanges when updating an existing task', async () => {
      gitlabApiServiceSpy.getById$.and.returnValue(of(mockGitlabIssue));

      const result = await service.getFreshDataForIssueTask(mockTask);

      expect(result).not.toBeNull();
      expect('dueDay' in result!.taskChanges).toBe(false);
      expect(result!.taskChanges.issueWasUpdated).toBe(true);
    });

    it('should still include other task fields in taskChanges', async () => {
      gitlabApiServiceSpy.getById$.and.returnValue(of(mockGitlabIssue));

      const result = await service.getFreshDataForIssueTask(mockTask);

      expect(result).not.toBeNull();
      expect(result!.taskChanges.title).toBe('#42 Test issue');
      expect(result!.taskChanges.isDone).toBe(false);
      expect(result!.taskChanges.issueId).toBe('test/project#42');
    });

    it('should NOT include dueDay when update is triggered by a new comment', async () => {
      const issueWithOldTimestamp = {
        ...mockGitlabIssue,
        updated_at: '2026-02-01T00:00:00Z',
        comments: [
          {
            author: { username: 'someone-else' },
            created_at: '2026-03-12T00:00:00Z',
          },
        ],
      } as any as GitlabIssue;
      const cfgWithFilter = { ...mockGitlabCfg, filterUsername: '' };
      issueProviderServiceSpy.getCfgOnce$.and.returnValue(of(cfgWithFilter as any));
      gitlabApiServiceSpy.getById$.and.returnValue(of(issueWithOldTimestamp));

      const result = await service.getFreshDataForIssueTask(mockTask);

      expect(result).not.toBeNull();
      expect('dueDay' in result!.taskChanges).toBe(false);
      expect(result!.taskChanges.issueWasUpdated).toBe(true);
    });

    it('should return null when issue has not been updated', async () => {
      const upToDateTask = {
        ...mockTask,
        issueLastUpdated: new Date('2026-03-12T00:00:00Z').getTime(),
      } as Task;
      gitlabApiServiceSpy.getById$.and.returnValue(of(mockGitlabIssue));

      const result = await service.getFreshDataForIssueTask(upToDateTask);

      expect(result).toBeNull();
    });
  });
});
