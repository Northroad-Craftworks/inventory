#/bin/bash -ex
helm upgrade --install \
    --namespace production \
    --create-namespace \
    -f values.yaml \
    database \
    couchdb/couchdb
