import { createClient } from "polkadot-api";
import { Observable, map, interval } from "rxjs";
import { getWsProvider } from "polkadot-api/ws-provider/web";
import { dot } from "@polkadot-api/descriptors";

const client = createClient(
  getWsProvider("wss://polkadot-rpc.publicnode.com")
);
const typedApi = client.getTypedApi(dot);

const ACCOUNT = "1jbZxCFeNMRgVRfggkknf8sTWzrVKbzLvRuLWvSyg9bByRG";
const TRACK = 33;

const getVoteDirection = (vote: number): "aye" | "nay" => (vote & 0x80) ? "aye" : "nay";

const referendaWithSameOutcome$: Observable<number[]> = typedApi.query.ConvictionVoting.VotingFor.watchValue(ACCOUNT, TRACK)
  .pipe(
    switchMap(votingRecord => {
            if (!votingRecord || votingRecord.type !== 'casting' || votingRecord.casting.votes.length === 0) {
        return of([]);
      }
      const userVotes = new Map<number, "aye" | "nay">(
        votingRecord.casting.votes.map(([index, voteInfo]) => [
          index,
          getVoteDirection(voteInfo.standard.vote)
        ])
      );
      
      const referendumIndices = [...userVotes.keys()];

      return from(typedApi.query.Referenda.ReferendumInfoFor.getValues(referendumIndices)).pipe(
        map(referendumInfos => {
          return referendumIndices.filter((refIndex, i) => {
            const info = referendumInfos[i];
            const userVote = userVotes.get(refIndex);
            if (!info || info.type === 'Ongoing') {
                return false;
            }

            const outcome: "aye" | "nay" = info.type === 'Approved' ? 'aye' : 'nay';
            
            return userVote === outcome;
          });
        })
      );
    })
  );

referendaWithSameOutcome$.subscribe(matchingReferendaIndices => {
  console.log("Referenda where the user's vote matched the outcome:", matchingReferendaIndices);
});