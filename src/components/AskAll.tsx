import { useEffect, useState } from 'react';
import { libraryChatSystem, rankMeetings } from '../lib/prompts';
import { meetingsDb } from '../lib/storage';
import type { ChatMsg, Meeting } from '../lib/types';
import { ChatBox } from './ChatBox';

export function AskAll() {
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [msgs, setMsgs] = useState<ChatMsg[]>([]);

  useEffect(() => {
    meetingsDb.all().then(setMeetings);
  }, []);

  return (
    <div className="page narrow">
      <h1>Ask across all meetings</h1>
      <p className="muted">
        Your meeting memory. Ask about promises, numbers, decisions or people from any past meeting ({meetings.length}{' '}
        saved).
      </p>
      <div className="card">
        <ChatBox
          system={(all) =>
            // Pick the meetings most relevant to the latest question to keep the prompt small.
            libraryChatSystem(rankMeetings(meetings, all.filter((m) => m.role === 'user').slice(-2).map((m) => m.content).join(' ')))
          }
          messages={msgs}
          onChange={setMsgs}
          placeholder="e.g. What did we promise Acme about pricing?"
          starters={[
            'What are all my open action items?',
            'Summarize everything from this week',
            'Which clients raised pricing objections?',
          ]}
        />
      </div>
    </div>
  );
}
