# Pull requests on mobile

Open **Pull requests** from Home or the sidebar to browse repositories in a
connected environment. Search by title, `#number` or author, then use the row
beneath the search field:

- **Sort** orders the pull requests already loaded: recently or least recently
  updated, newest or oldest.
- **Filters** opens a sheet for state (open, merged, closed, all), involvement
  (everyone, review requested, authored by you) and project. A badge shows how
  many filters differ from the defaults, and **Reset** clears them.
- The environment menu appears when more than one environment is connected.
- The refresh button asks the host for fresh results. Pull down on the list
  does the same.

Each row shows the state, title, repository, number, author, branch and how
recently it changed. A list that cannot load shows the reason with a **Retry**
button. If some rows loaded and a project or host did not, a single notice above
the list names what is missing. **Load more** appears when more results are
available.

Select a pull request to read its **Summary** (description, checks, reviewers,
labels, merge status), follow comments and commits in **Timeline**, or inspect
changed files in **Code**. On a phone the pull request replaces the list and Back
returns to it. On a wide screen, such as an unfolded foldable or a tablet, the
list stays beside the selected pull request, and the open tab and any draft
comment carry across folding and unfolding. Tap a long title to show all of it.

The Code tab loads large changes a slice at a time; **Next files** continues and
**First files** returns to the beginning. Collapse file headers or mark files as
viewed while reviewing the current pull request.

The Timeline tab offers comments and supported review verdicts when your account
has permission. Submission asks for confirmation. If it fails, your draft stays
in the editor. **Open on host** opens the full pull request for merging, inline
comments, or content that the connected provider cannot supply.

Repository access and authentication use the connected environment's source
control tools. A missing tool, an expired login or a host rate limit appears in
the list so you can repair it on the environment. Pull request viewing also
works over remote connections.
