
#!/bin/bash

# Define a list of strings
pids=""
repos="verse-core verse-http verse-jsonapi verse-sequel verse-schema verse-redis verse-periodic"

# Loop over each string in the list
for repo in $repos; do
  ./common/gems/update.sh $repo &
  pids="$pids $!"
done

# Wait for all background jobs to finish and check their exit status
for pid in $pids; do
    if ! wait $pid; then
      echo "Cloning/Update failed."
      exit 1
    fi
done

echo "Cloning/Update successful."