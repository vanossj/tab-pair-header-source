# tab-pair-header-source package

Shorten the tab for open header/source files.

![A screenshot of your package](https://cloud.githubusercontent.com/assets/8310169/18635418/08915d68-7e53-11e6-93ab-4cba10293684.gif)

## Settings
### Basic Mode
List all extensions that should be matched if the filename is the same.
Check *Match Full Path* to force matching files to be in the same directory.

### Advanced Mode
Select the *Advanced Mode Enable* box to use custom RegExp patters to determine matched files.
List the Regular Expressions in the *Advanced Mode Reg Exp* box. Files will be considered matches
if they have the same information in all capture groups of the same RegExp.

#### Examples
##### Grouping by filename (in same folder)
```
module/
  projects/
    projects.html
    projects.js
    projects.css
```
becomes `[ projects.html | .js | .css ]`

###### RegExp:
`([^/\\]+?)(?:\.js|\.html|\.css)$` Matches Filename, not directory (same as basic mode)

`^(.+?)(?:\.js|\.html|\.css)$` Matches Filename and directory (same as basic mode with match full path option)

##### Grouping src and tests
```
src/
  app/
    plugins/
      feature1.js
      feature1.spec.js
```
becomes `[ feature1.js | .spec.js ]`

`([^/\\]+?)(?:\.spec\.js|\.js)$` Matches Filename, not directory (same as basic mode)

`^(.+?)(?:\.spec\.js|\.js)$` Matches Filename and directory (same as basic mode with match full path option)

##### Grouping src and tests (enforcing tree structure)
```
src/
  app/
    plugins/
      feature1.js
test/
  app/
    plugins/
      feature1.spec.js
```
becomes `[ feature1.js | .spec.js ]`

###### RegExp:    
`^(.+?)(?:\/(?:src|test)\/)(.+?)(?:\.js|\.spec\.js)$`
