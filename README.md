# inventory
Inventory management tools

## Deployment
### CouchDB
```bash
helm install couchdb/couchdb \
    --namespace production
    --
    --set allowAdminParty=true \
    --set couchdbConfig.couchdb.uuid=$(curl https://www.uuidgenerator.net/api/version4 2>/dev/null | tr -d -)
```