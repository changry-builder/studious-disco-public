/** The ten rules of "How to play", from docs/game-design.md section 3. */
export function RulesList() {
  return (
    <ol className="rules" aria-label="How to play">
      <li>Everyone stays in one room for each half-hour.</li>
      <li>Innocent people tell the truth, and they name everyone who was in the room with them.</li>
      <li>The killer lies about one thing only: where they were in the half-hour of the murder. Everything else the killer says is true.</li>
      <li>
        At most one other person lies, about one half-hour only, in one of two ways:
        <ul>
          <li>
            <b>Covering for the killer.</b> They have a bond with the killer that you can find. They say the killer was with them during the murder. Where they say they were, and who else they name, is true.
          </li>
          <li>
            <b>Hiding a private errand.</b> They say "I was alone" in a room they were not in.
          </li>
        </ul>
      </li>
      <li>Any lie other than that cover story has the form "I was alone in such a room". So two people with no bond who name each other are both telling the truth.</li>
      <li>Show a liar any true evidence that contradicts them and they will change their story. The other liar then tells the truth. The killer tells a new lie. Someone who changes their story is the killer or that one other liar.</li>
      <li>During the murder, only the killer and the victim were in the room. Nobody entered that room afterwards.</li>
      <li>The killer took the weapon from where it is kept while alone there, or it was already in the room. A locked weapon can only be taken by someone with a key.</li>
      <li>The killer has a motive, and proof of it can be found.</li>
      <li>Physical evidence never lies.</li>
    </ol>
  );
}
