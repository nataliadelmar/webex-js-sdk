import {assert} from '@webex/test-helper-chai';
import sinon from 'sinon';
import MockWebex from '@webex/test-helper-mock-webex';
import {_MEETING_ID_} from '@webex/plugin-meetings/src/constants';

import MeetingInfo from '@webex/plugin-meetings/src/meeting-info/index';
import MeetingInfoUtil from '@webex/plugin-meetings/src/meeting-info/util';
import MeetingInfoRequest from '@webex/plugin-meetings/src/meeting-info/request';

const flushPromises = () => new Promise(setImmediate);

describe('plugin-meetings', () => {
  let webex;
  let meetingInfo = null;

  afterEach(() => {
    sinon.restore();
  });

  describe('Meeting Info V1', () => {
    beforeEach(() => {
      webex = new MockWebex({});

      meetingInfo = new MeetingInfo(webex);
    });

    describe('#fetchMeetingInfo', () => {
      const checkResolvedFetchMeetingInfo = async ({meetingId, hasPrejoinStarted, shouldSendCAMetrics}) => {
        const body = {meetingKey: '1234323'};

        sinon
          .stub(MeetingInfoUtil, 'generateOptions')
          .resolves({type: 'MEETING_ID', destination: '123456'});
        sinon.stub(MeetingInfoRequest.prototype, 'fetchMeetingInfo').returns(Promise.resolve(body));

        await meetingInfo.fetchMeetingInfo('1234323', _MEETING_ID_, null, null, null, null, null, {
          meetingId,
          hasPrejoinStarted,
        });

        const submitInternalEventCalls = webex.internal.newMetrics.submitInternalEvent.getCalls();
        const submitClientEventCalls = webex.internal.newMetrics.submitClientEvent.getCalls();

        if (shouldSendCAMetrics) {
          assert.deepEqual(submitInternalEventCalls[0].args[0], {
            name: 'internal.client.meetinginfo.request',
          });
          assert.deepEqual(submitClientEventCalls[0].args[0], {
            name: 'client.meetinginfo.request',
            options: {
              meetingId,
            },
          });
  
          assert.deepEqual(submitInternalEventCalls[1].args[0], {
            name: 'internal.client.meetinginfo.response',
          });
          assert.deepEqual(submitClientEventCalls[1].args[0], {
            name: 'client.meetinginfo.response',
            options: {
              meetingId,
            },
          });
        } else {
          assert.notCalled(webex.internal.newMetrics.submitInternalEvent);
          assert.notCalled(webex.internal.newMetrics.submitClientEvent);
        }
      }
      it('should send ca events if meetingId present and', async () => {
        checkResolvedFetchMeetingInfo({meetingId: 'meetingId', hasPrejoinStarted: true, shouldSendCAMetrics: true});
      });

      it('should not send ca events if meetingId not present', async () => {
        checkResolvedFetchMeetingInfo({hasPrejoinStarted: true, shouldSendCAMetrics: false});
      });

      it('should not send ca events if prejoin has not started', async () => {
        checkResolvedFetchMeetingInfo({meetingId: 'meetingId', shouldSendCAMetrics: false});
      });

      it('should not send ca events if meeting id is not present and prejoin has not started', async () => {
        checkResolvedFetchMeetingInfo({shouldSendCAMetrics: false});
      });

      const checkFailingFetchMeetingInfo = async ({meetingId, hasPrejoinStarted, shouldSendCAMetrics}) => {
        const reject = {
          statusCode: 403,
          body: {message: 'msg', code: 403102, data: {meetingInfo: {}}},
          url: 'http://api-url.com',
        };

        sinon
          .stub(MeetingInfoUtil, 'generateOptions')
          .returns(Promise.resolve({type: 'MEETING_ID', destination: '123456'}));
        sinon
          .stub(MeetingInfoRequest.prototype, 'fetchMeetingInfo')
          .returns(Promise.reject(reject));

        try {
          await meetingInfo.fetchMeetingInfo(
            '1234323',
            _MEETING_ID_,
            null,
            null,
            null,
            null,
            null,
            {
              meetingId,
              hasPrejoinStarted,
            }
          );
        } catch (err) {
          const submitInternalEventCalls = webex.internal.newMetrics.submitInternalEvent.getCalls();
          const submitClientEventCalls = webex.internal.newMetrics.submitClientEvent.getCalls();

          if(shouldSendCAMetrics) {
            assert.deepEqual(submitInternalEventCalls[0].args[0], {
              name: 'internal.client.meetinginfo.request',
            });
  
            assert.deepEqual(submitClientEventCalls[0].args[0], {
              name: 'client.meetinginfo.request',
              options: {
                meetingId: 'meetingId',
              },
            });
  
            assert.deepEqual(submitInternalEventCalls[1].args[0], {
              name: 'internal.client.meetinginfo.response',
            });
  
            assert.deepEqual(submitClientEventCalls[1].args[0], {
              name: 'client.meetinginfo.response',
              payload: {
                identifiers: {
                  meetingLookupUrl: 'http://api-url.com',
                },
              },
              options: {
                meetingId: 'meetingId',
                rawError: err,
              },
            });
          } else {
            assert.notCalled(webex.internal.newMetrics.submitInternalEvent);
            assert.notCalled(webex.internal.newMetrics.submitClientEvent);
          }
        }
      }

      it('should send ca events when fails if meetingId present and hasPrejoinStarted', async () => {
        checkFailingFetchMeetingInfo({meetingId: 'meetingId', hasPrejoinStarted: true, shouldSendCAMetrics: true})
      });

      it('should not send ca events when fails if meetingId present and hasPrejoin not started', async () => {
        checkFailingFetchMeetingInfo({meetingId: 'meetingId', shouldSendCAMetrics: false})
      });

      it('should not send ca events when fails if meetingId not present and hasPrejoinstarted', async () => {
        checkFailingFetchMeetingInfo({hasPrejoinStarted: true, shouldSendCAMetrics: false})
      });

      it('should not send ca events when fails if meetingId not present and hasPrejoin not started', async () => {
        checkFailingFetchMeetingInfo({shouldSendCAMetrics: false})
      });

      const checkRetryFetchMeetingInfo = async ({meetingId, hasPrejoinStarted, shouldSendCAMetrics}) => {
        const reject = {
          statusCode: 403,
          body: {message: 'msg', code: 403102, data: {meetingInfo: {}}},
          url: 'http://api-url.com',
        };

        sinon
          .stub(MeetingInfoUtil, 'generateOptions')
          .resolves({type: 'MEETING_LINK', destination: '123456'});
        const requestStub = sinon
          .stub(MeetingInfoRequest.prototype, 'fetchMeetingInfo')
          .rejects(reject);

        try {
          await meetingInfo.fetchMeetingInfo(
            '1234323',
            _MEETING_ID_,
            null,
            null,
            null,
            null,
            null,
            {
              meetingId,
              hasPrejoinStarted,
            }
          );
          assert.fail('fetchMeetingInfo should have thrown, but has not done that');
        } catch (err) {
          let submitInternalEventCalls = webex.internal.newMetrics.submitInternalEvent.getCalls();
          let submitClientEventCalls = webex.internal.newMetrics.submitClientlEvent.getCalls();

          if(shouldSendCAMetrics) {
            assert.deepEqual(submitInternalEventCalls[0].args[0], {
              name: 'internal.client.meetinginfo.request',
            });
  
            assert.deepEqual(submitClientEventCalls[0].args[0], {
              name: 'client.meetinginfo.request',
            });
  
            assert.deepEqual(submitInternalEventCalls[1].args[0], {
              name: 'internal.client.meetinginfo.response',
            });
  
            assert.deepEqual(submitClientEventCalls[1].args[0], {
              name: 'client.meetinginfo.response',
              payload: {
                identifiers: {
                  meetingLookupUrl: 'http://api-url.com',
                },
              },
              options: {
                meetingId: 'meetingId',
                rawError: err,
              },
            });
  
            assert.deepEqual(submitInternalEventCalls[2].args[0], {
              name: 'internal.client.meetinginfo.request',
            });
  
            assert.deepEqual(submitClientEventCalls[2].args[0], {
              name: 'client.meetinginfo.request',
            });
          } else {
            assert.notCalled(webex.internal.newMetrics.submitInternalEvent);
            assert.notCalled(webex.internal.newMetrics.submitClientEvent);
          }

          requestStub.resolves({});

          await flushPromises();

          submitInternalEventCalls = webex.internal.newMetrics.submitInternalEvent.getCalls();
          submitClientEventCalls = webex.internal.newMetrics.submitClientEvent.getCalls();

          if(shouldSendCAMetrics) {
            assert.deepEqual(submitInternalEventCalls[3].args[0], {
              name: 'internal.client.meetinginfo.response',
            });
  
            assert.deepEqual(submitClientEventCalls[3].args[0], {
              name: 'internal.client.meetinginfo.response',
            });
          } else {
            assert.notCalled(webex.internal.newMetrics.submitInternalEvent);
            assert.notCalled(webex.internal.newMetrics.submitClientEvent);
          }
        }
      }

      it('should send ca events when in the retry as well if meetingId present and hasPrejoinStarted', async () => {
        checkRetryFetchMeetingInfo({meetingId: 'meetingId', hasPrejoinStarted: true, shouldSendCAMetrics: true})
      });

      it('should not send ca events when in the retry as well if meetingId not present and hasPrejoinStarted', async () => {
        checkRetryFetchMeetingInfo({hasPrejoinStarted: true, shouldSendCAMetrics: false})
      });

      it('should not send ca events when in the retry as well if meetingId present and hasPrejoin not Started', async () => {
        checkRetryFetchMeetingInfo({meetingId: 'meetingId', shouldSendCAMetrics: false})
      });

      it('should not send ca events when in the retry as well if meetingId not present and hasPrejoin not Started', async () => {
        checkRetryFetchMeetingInfo({shouldSendCAMetrics: false})
      });
    });
  });
});
