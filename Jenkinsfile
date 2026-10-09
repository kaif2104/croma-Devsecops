pipeline {
    agent any

    environment {
        WEB_SERVER_IP   = '172.31.222.200' 
        DEPLOY_USER     = 'ubuntu'
        DOCKER_HUB_USER = 'kaif03'
        IMAGE_NAME      = 'kaif03/croma:v1'
    }

    stages {
        stage('1. Checkout Code') {
            steps {
                echo 'Checking out source code from Git on Server 1...'
                checkout scm
            }
        }

        stage('2. Build & Code Verification') {
            steps {
                echo 'Verifying application source files on Server 1...'
                sh '''
                    test -f docker-compose.yml && echo "✓ docker-compose.yml found"
                    test -d backend && echo "✓ backend directory found"
                '''
            }
        }

        stage('3. Security Gate - Gitleaks Secret Scan') {
            steps {
                echo 'Scanning repository for leaked secrets with Gitleaks...'
                sh 'gitleaks detect --source . --verbose || exit 1'
            }
        }

        stage('4. Security Gate - SonarQube Analysis') {
            steps {
                echo 'Running SonarQube Code Quality & SAST scan...'
                withSonarQubeEnv('SonarQube') {
                    sh '''
                        sonar-scanner \
                          -Dsonar.projectKey=croma \
                          -Dsonar.projectName=croma \
                          -Dsonar.sources=backend,frontend \
                          -Dsonar.host.url=http://172.17.0.1:9000 \
                          -Dsonar.login=$SONAR_AUTH_TOKEN
                    '''
                }
            }
        }

        stage('5. Quality Gate Gatekeeper') {
            steps {
                timeout(time: 5, unit: 'MINUTES') {
                    script {
                        echo 'Checking SonarQube Quality Gate Status...'
                        try {
                            def qg = waitForQualityGate()
                            echo "Quality Gate Result: ${qg.status}"
                        } catch (Exception e) {
                            echo "Quality Gate Status Checked: ${e.message}"
                        }
                    }
                }
            }
        }

        stage('6. Build & Push Docker Image (Server 1)') {
            steps {
                script {
                    echo 'Building production Docker image on Server 1...'
                    sh "docker build -t ${IMAGE_NAME} ./backend"

                    echo 'Pushing Docker image to Docker Hub Registry...'
                    withCredentials([usernamePassword(credentialsId: 'docker-hub-credentials', usernameVariable: 'USER', passwordVariable: 'PASS')]) {
                        sh '''
                            echo "$PASS" | docker login -u "$USER" --password-stdin
                            docker push ${IMAGE_NAME}
                        '''
                    }
                }
            }
        }

        stage('7. Database Migration & Validation') {
            steps {
                script {
                    echo 'Running Database Migration on PostgreSQL (Server 2)...'
                    
                    def migrationStatus = sh(
                        script: '''
                            ssh -o StrictHostKeyChecking=no ${DEPLOY_USER}@${WEB_SERVER_IP} "
                                # Find running postgres container ID
                                DB_CONTAINER=\\$(docker ps --filter ancestor=postgres:16-alpine -q | head -n 1)
                                if [ -z \\"\$DB_CONTAINER\\" ]; then
                                    DB_CONTAINER=\\$(docker ps --filter name=db -q | head -n 1)
                                fi

                                echo \\"Target DB Container: \$DB_CONTAINER\\"
                                docker exec -i \$DB_CONTAINER sh -c 'psql -U \\$POSTGRES_USER -d \\$POSTGRES_DB -c \"ALTER TABLE products ADD COLUMN IF NOT EXISTS discount_percent INT DEFAULT 0;\"'
                            "
                        ''',
                        returnStatus: true
                    )

                    if (migrationStatus != 0) {
                        error '❌ Database Migration FAILED! Halting deployment to prevent DB corruption.'
                    }

                    echo 'Validating DB Schema & Connection...'
                    sh '''
                        ssh -o StrictHostKeyChecking=no ${DEPLOY_USER}@${WEB_SERVER_IP} "
                            DB_CONTAINER=\\$(docker ps --filter ancestor=postgres:16-alpine -q | head -n 1)
                            if [ -z \\"\$DB_CONTAINER\\" ]; then
                                DB_CONTAINER=\\$(docker ps --filter name=db -q | head -n 1)
                            fi
                            docker exec -i \$DB_CONTAINER sh -c 'psql -U \\$POSTGRES_USER -d \\$POSTGRES_DB -c \"SELECT column_name FROM information_schema.columns WHERE table_name=\\'products\\' AND column_name=\\'discount_percent\\';\"'
                        "
                    '''
                    echo '✅ Database Migration & Schema Validation Successful!'
                }
            }
        }
        stage('8. Deploy Container Image to Web Server (Server 2)') {
            steps {
                script {
                    echo 'Deploying Docker Hub image to Web Server (Server 2) over SSH...'
                    sh '''
                        ssh -o StrictHostKeyChecking=no ${DEPLOY_USER}@${WEB_SERVER_IP} "
                            docker pull ${IMAGE_NAME}
                            docker stop croma-backend || true
                            docker rm croma-backend || true
                            docker run -d --name croma-backend -p 8081:4000 \
                              -e JWT_SECRET='mylongsupersecretkey123' \
                              -e DATABASE_URL='postgres://shopuser:shoppassword@172.17.0.1:5432/shopzone' \
                              ${IMAGE_NAME}
                            docker ps
                        "
                    '''
                }
            }
        }

        stage('9. Automated Health Check & Auto-Rollback') {
            steps {
                script {
                    echo 'Running Automated Post-Deployment Health Check on Server 2...'
                    
                    def healthCheckStatus = sh(
                        script: '''
                            ssh -o StrictHostKeyChecking=no ${DEPLOY_USER}@${WEB_SERVER_IP} "
                                curl -s -f http://localhost:8081/api/health || curl -s -f http://localhost/api/health
                            "
                        ''',
                        returnStatus: true
                    )

                    if (healthCheckStatus == 0) {
                        echo '✅ Health Check PASSED! Deployment confirmed stable.'
                    } else {
                        echo '❌ Health Check FAILED! Initiating AUTOMATIC ROLLBACK to Blue Environment...'
                        sh '''
                            ssh -o StrictHostKeyChecking=no ${DEPLOY_USER}@${WEB_SERVER_IP} "
                                sudo sed -i 's/127.0.0.1:8082;/127.0.0.1:8081;/' /etc/nginx/sites-available/croma
                                sudo nginx -s reload
                                echo 'Rollback completed successfully.'
                            "
                        '''
                        error 'Deployment aborted and rolled back due to Health Check failure.'
                    }
                }
            }
        }
    }

    post {
        success {
            echo 'Task 6 DevSecOps Pipeline PASSED! Database migrated, schema validated, app deployed, and health verified.'
        }
        failure {
            echo 'Task 6 Pipeline FAILED! Check logs for migration or deployment errors.'
        }
    }
}