-- MariaDB dump 10.19  Distrib 10.4.32-MariaDB, for Win64 (AMD64)
--
-- Host: localhost    Database: havenly_real_estate
-- ------------------------------------------------------
-- Server version	10.4.32-MariaDB

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Table structure for table `admin_users`
--

DROP TABLE IF EXISTS `admin_users`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `admin_users` (
  `admin_id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `first_name` varchar(80) NOT NULL,
  `last_name` varchar(80) NOT NULL,
  `email` varchar(255) NOT NULL,
  `password_hash` varchar(255) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`admin_id`),
  UNIQUE KEY `email` (`email`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `admin_users`
--

LOCK TABLES `admin_users` WRITE;
/*!40000 ALTER TABLE `admin_users` DISABLE KEYS */;
INSERT INTO `admin_users` VALUES (1,'Havenly','Admin','admin@havenly.local','$2y$10$dIonOhhHnD5awtXtyMvIHuY1/xDY3eBV1EYqSClhFOFTB0dsdEwga','2026-08-13 07:14:38');
/*!40000 ALTER TABLE `admin_users` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `agents`
--

DROP TABLE IF EXISTS `agents`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `agents` (
  `agent_id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(160) NOT NULL,
  `title` varchar(120) DEFAULT NULL,
  `email` varchar(255) DEFAULT NULL,
  `phone` varchar(30) DEFAULT NULL,
  `photo_url` varchar(500) DEFAULT NULL,
  `bio` text DEFAULT NULL,
  `is_published` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`agent_id`),
  UNIQUE KEY `uq_agent_email` (`email`),
  KEY `idx_agent_published` (`is_published`,`name`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `agents`
--

LOCK TABLES `agents` WRITE;
/*!40000 ALTER TABLE `agents` DISABLE KEYS */;
INSERT INTO `agents` VALUES (1,'John Doe','Senior Agent','john@example.com','1234567890','https://placehold.co/300','Experienced agent',1,'2026-08-13 07:56:10','2026-08-13 07:56:10'),(2,'Jane Smith','Agent','jane@example.com','0987654321','https://placehold.co/300','Local specialist',1,'2026-08-13 07:56:10','2026-08-13 07:56:10');
/*!40000 ALTER TABLE `agents` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `enquiries`
--

DROP TABLE IF EXISTS `enquiries`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `enquiries` (
  `enquiry_id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `property_id` int(10) unsigned DEFAULT NULL,
  `name` varchar(160) NOT NULL,
  `email` varchar(255) NOT NULL,
  `phone` varchar(30) DEFAULT NULL,
  `interest` enum('buying','selling','renting','agent') NOT NULL,
  `message` text DEFAULT NULL,
  `status` enum('new','contacted','closed') NOT NULL DEFAULT 'new',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`enquiry_id`),
  KEY `fk_enquiries_property` (`property_id`),
  KEY `idx_enquiry_status` (`status`,`created_at`),
  CONSTRAINT `fk_enquiries_property` FOREIGN KEY (`property_id`) REFERENCES `properties` (`property_id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `enquiries`
--

LOCK TABLES `enquiries` WRITE;
/*!40000 ALTER TABLE `enquiries` DISABLE KEYS */;
INSERT INTO `enquiries` VALUES (1,5,'Site Visitor','visitor@example.com','0000000000','renting','I am interested in this rental.','new','2026-08-13 08:00:47');
/*!40000 ALTER TABLE `enquiries` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `home_gallery`
--

DROP TABLE IF EXISTS `home_gallery`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `home_gallery` (
  `gallery_id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `image_url` varchar(500) NOT NULL,
  `caption` varchar(255) DEFAULT NULL,
  `sort_order` tinyint(3) unsigned NOT NULL DEFAULT 0,
  `is_published` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`gallery_id`),
  UNIQUE KEY `uq_home_gallery_image` (`image_url`),
  KEY `idx_home_gallery` (`is_published`,`sort_order`,`gallery_id`)
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `home_gallery`
--

LOCK TABLES `home_gallery` WRITE;
/*!40000 ALTER TABLE `home_gallery` DISABLE KEYS */;
INSERT INTO `home_gallery` VALUES (1,'https://images.unsplash.com/photo-1600607688969-a5bfcd646154?auto=format&fit=crop&w=1000&q=85','Natural materials',0,1,'2026-08-13 07:14:38'),(2,'https://images.unsplash.com/photo-1600566753190-17f0baa2a6c3?auto=format&fit=crop&w=1000&q=85','Warm and considered interiors',1,1,'2026-08-13 07:14:38'),(3,'https://images.unsplash.com/photo-1600585152915-d208bec867a1?auto=format&fit=crop&w=1000&q=85','Architecture with presence',2,1,'2026-08-13 07:14:38'),(4,'https://images.unsplash.com/photo-1613490493576-7fde63acd811?auto=format&fit=crop&w=1000&q=85','Indoor-outdoor living',3,1,'2026-08-13 07:14:38'),(5,'https://images.unsplash.com/photo-1600607687920-4e2a09cf159d?auto=format&fit=crop&w=1000&q=85','A calm place to return to',4,1,'2026-08-13 07:14:38');
/*!40000 ALTER TABLE `home_gallery` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `popup_ads`
--

DROP TABLE IF EXISTS `popup_ads`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `popup_ads` (
  `popup_id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `image_url` varchar(500) DEFAULT NULL,
  `link_url` varchar(500) DEFAULT NULL,
  `headline` varchar(255) DEFAULT NULL,
  `html_content` text DEFAULT NULL,
  `is_published` tinyint(1) NOT NULL DEFAULT 1,
  `sort_order` tinyint(3) unsigned NOT NULL DEFAULT 0,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`popup_id`),
  KEY `idx_popup_published` (`is_published`,`sort_order`,`popup_id`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `popup_ads`
--

LOCK TABLES `popup_ads` WRITE;
/*!40000 ALTER TABLE `popup_ads` DISABLE KEYS */;
INSERT INTO `popup_ads` VALUES (1,'https://placehold.co/800x400','https://example.com','Welcome','<p>Welcome to the site!</p>',1,0,'2026-08-13 07:56:10','2026-08-13 07:56:10'),(2,'https://placehold.co/800x400/ffcc00','https://example.com/offer','Special Offer','<p>Limited time offer</p>',1,1,'2026-08-13 07:56:10','2026-08-13 07:56:10');
/*!40000 ALTER TABLE `popup_ads` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `project_media`
--

DROP TABLE IF EXISTS `project_media`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `project_media` (
  `media_id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `project_id` int(10) unsigned NOT NULL,
  `media_type` enum('gallery','plan') NOT NULL,
  `file_path` varchar(500) NOT NULL,
  `caption` varchar(255) DEFAULT NULL,
  `sort_order` tinyint(3) unsigned NOT NULL DEFAULT 0,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`media_id`),
  UNIQUE KEY `uq_project_media` (`project_id`,`media_type`,`file_path`),
  KEY `idx_project_media` (`project_id`,`media_type`,`sort_order`),
  CONSTRAINT `fk_project_media` FOREIGN KEY (`project_id`) REFERENCES `projects` (`project_id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=17 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `project_media`
--

LOCK TABLES `project_media` WRITE;
/*!40000 ALTER TABLE `project_media` DISABLE KEYS */;
INSERT INTO `project_media` VALUES (1,1,'gallery','https://images.unsplash.com/photo-1600607688969-a5bfcd646154?auto=format&fit=crop&w=1000&q=85','Harbor Point living room',0,'2026-08-13 07:14:38'),(2,1,'gallery','https://images.unsplash.com/photo-1600566753190-17f0baa2a6c3?auto=format&fit=crop&w=1000&q=85','Waterfront materials',1,'2026-08-13 07:14:38'),(3,1,'plan','https://placehold.co/1000x700/f8f6ef/1e2b27?text=Harbor+Point+Floor+Plan','Two bedroom residence',0,'2026-08-13 07:14:38'),(4,2,'gallery','https://images.unsplash.com/photo-1600566753190-17f0baa2a6c3?auto=format&fit=crop&w=1000&q=85','Aster Heights interiors',0,'2026-08-13 07:14:38'),(5,2,'plan','https://placehold.co/1000x700/f8f6ef/1e2b27?text=Aster+Heights+Floor+Plan','City apartment plan',0,'2026-08-13 07:14:38'),(6,3,'gallery','https://images.unsplash.com/photo-1600607688969-a5bfcd646154?auto=format&fit=crop&w=1000&q=85','Parkside Villa living',0,'2026-08-13 07:14:38'),(7,3,'plan','https://placehold.co/1000x700/f8f6ef/1e2b27?text=Parkside+Villa+Plan','Villa plan',0,'2026-08-13 07:14:38'),(8,4,'gallery','https://images.unsplash.com/photo-1600585152915-d208bec867a1?auto=format&fit=crop&w=1000&q=85','Cedar Square facade',0,'2026-08-13 07:14:38'),(9,4,'plan','https://placehold.co/1000x700/f8f6ef/1e2b27?text=Cedar+Square+Plan','Townhome plan',0,'2026-08-13 07:14:38'),(10,5,'gallery','https://images.unsplash.com/photo-1600607687920-4e2a09cf159d?auto=format&fit=crop&w=1000&q=85','Bayview residence',0,'2026-08-13 07:14:38'),(11,5,'plan','https://placehold.co/1000x700/f8f6ef/1e2b27?text=Bayview+Residence+Plan','Coastal plan',0,'2026-08-13 07:14:38'),(12,6,'gallery','https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?auto=format&fit=crop&w=1000&q=85','The Arc interiors',0,'2026-08-13 07:14:38'),(13,6,'plan','https://placehold.co/1000x700/f8f6ef/1e2b27?text=The+Arc+Plan','Urban residence plan',0,'2026-08-13 07:14:38'),(14,7,'gallery','https://images.unsplash.com/photo-1600566753086-00f18fb6b3ea?auto=format&fit=crop&w=1000&q=85','Orchard House exterior',0,'2026-08-13 07:14:38'),(15,7,'plan','https://placehold.co/1000x700/f8f6ef/1e2b27?text=Orchard+House+Plan','Garden home plan',0,'2026-08-13 07:14:38'),(16,8,'gallery','https://placehold.co/1000x600','Demo project image',0,'2026-08-13 08:00:47');
/*!40000 ALTER TABLE `project_media` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `projects`
--

DROP TABLE IF EXISTS `projects`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `projects` (
  `project_id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `title` varchar(180) NOT NULL,
  `category` varchar(100) NOT NULL,
  `location` varchar(180) NOT NULL,
  `status` enum('published','draft') NOT NULL DEFAULT 'draft',
  `hero_image_url` varchar(500) DEFAULT NULL,
  `headline` varchar(255) DEFAULT NULL,
  `description` text DEFAULT NULL,
  `payment_plans` text DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`project_id`),
  UNIQUE KEY `uq_project_title` (`title`),
  KEY `idx_project_status` (`status`,`updated_at`)
) ENGINE=InnoDB AUTO_INCREMENT=9 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `projects`
--

LOCK TABLES `projects` WRITE;
/*!40000 ALTER TABLE `projects` DISABLE KEYS */;
INSERT INTO `projects` VALUES (1,'Harbor Point Residences','Waterfront residences','Harbor District','published','https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=1800&q=85','Designed for the water’s edge','A collection of light-filled homes that balance quiet interiors with an open waterfront setting.',NULL,'2026-08-13 07:14:38','2026-08-13 07:14:38'),(2,'Aster Heights','City apartments','Central District','published','https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1800&q=85','A new perspective on city living','Thoughtful apartments with generous daylight, crafted materials, and a connected city address.',NULL,'2026-08-13 07:14:38','2026-08-13 07:14:38'),(3,'Parkside Villas','Private villas','Green Park','published','https://images.unsplash.com/photo-1613490493576-7fde63acd811?auto=format&fit=crop&w=1800&q=85','Made for slower days','A considered collection of private villas surrounded by landscape and everyday ease.',NULL,'2026-08-13 07:14:38','2026-08-13 07:14:38'),(4,'Cedar Square','Townhomes','Cedar Quarter','published','https://images.unsplash.com/photo-1600047509807-ba8f99d2cdde?auto=format&fit=crop&w=1800&q=85','A neighborhood within a neighborhood','Characterful townhomes shaped around walkable streets, gardens, and shared spaces.',NULL,'2026-08-13 07:14:38','2026-08-13 07:14:38'),(5,'Bayview Residences','Coastal apartments','Bayview','published','https://images.unsplash.com/photo-1600607687920-4e2a09cf159d?auto=format&fit=crop&w=1800&q=85','Coastal living, considered','Modern residences that bring the horizon, the breeze, and the sea closer to home.',NULL,'2026-08-13 07:14:38','2026-08-13 07:14:38'),(6,'The Arc at Central','Urban residences','Central District','published','https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?auto=format&fit=crop&w=1800&q=85','A landmark for everyday life','A lively mixed-use address where home, work, and the city come together.',NULL,'2026-08-13 07:14:38','2026-08-13 07:14:38'),(7,'Orchard House','Garden homes','Orchard Lane','published','https://images.unsplash.com/photo-1600566753086-00f18fb6b3ea?auto=format&fit=crop&w=1800&q=85','A home among the trees','A calm residential retreat with a garden-first approach to modern living.',NULL,'2026-08-13 07:14:38','2026-08-13 07:14:38'),(8,'Demo Block','Residential','Test City','published','https://placehold.co/1200x600','Demo project','A demo project for testing.',NULL,'2026-08-13 08:00:47','2026-08-13 08:00:47');
/*!40000 ALTER TABLE `projects` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `properties`
--

DROP TABLE IF EXISTS `properties`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `properties` (
  `property_id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `listing_type` enum('sale','rent') NOT NULL DEFAULT 'sale',
  `property_type` enum('House','Apartment','Villa','Condo','Land') NOT NULL,
  `status` enum('available','pending','sold','rented') NOT NULL DEFAULT 'available',
  `title` varchar(180) NOT NULL,
  `address_line1` varchar(255) NOT NULL,
  `city` varchar(100) NOT NULL,
  `state_region` varchar(100) DEFAULT NULL,
  `postal_code` varchar(25) DEFAULT NULL,
  `price` decimal(12,2) DEFAULT NULL,
  `bedrooms` decimal(3,1) DEFAULT NULL,
  `bathrooms` decimal(3,1) DEFAULT NULL,
  `area_sqft` int(10) unsigned DEFAULT NULL,
  `size_label` varchar(60) DEFAULT NULL,
  `property_facing` varchar(60) DEFAULT NULL,
  `price_pkr` decimal(15,2) DEFAULT NULL,
  `price_per_marla` decimal(12,2) DEFAULT NULL,
  `description` text DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`property_id`),
  KEY `idx_property_search` (`status`,`listing_type`,`property_type`,`city`,`price`)
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `properties`
--

LOCK TABLES `properties` WRITE;
/*!40000 ALTER TABLE `properties` DISABLE KEYS */;
INSERT INTO `properties` VALUES (1,'sale','House','available','Contemporary Pacific Heights Home','4236 Mornington Road','San Francisco','CA','94115',1850000.00,4.0,3.0,2820,NULL,NULL,NULL,NULL,'Light-filled contemporary home with garden views and generous entertaining spaces.','2026-08-13 07:14:38','2026-08-13 07:14:38'),(2,'sale','Apartment','available','Williamsburg Skyline Apartment','22 Wythe Avenue, Apt. 5B','Brooklyn','NY','11249',975000.00,2.0,2.0,1240,NULL,NULL,NULL,NULL,'A polished two-bedroom apartment in the heart of Williamsburg.','2026-08-13 07:14:38','2026-08-13 07:14:38'),(3,'sale','Villa','available','South Congress Design Villa','818 Meadow Lane','Austin','TX','78704',1245000.00,3.0,2.5,2460,NULL,NULL,NULL,NULL,'Warm materials, clever details, and easy access to Austin’s most-loved neighborhood.','2026-08-13 07:14:38','2026-08-13 07:14:38'),(4,'rent','Apartment','available','West Village Retreat','87 West 12th Street','New York','NY','10011',4800.00,1.0,1.0,760,NULL,NULL,NULL,NULL,'An elegant furnished rental in a peaceful West Village setting.','2026-08-13 07:14:38','2026-08-13 07:14:38'),(5,'rent','Apartment','available','Demo Rental Apartment','12 Test Street','Testville','TS','12345',1200.00,1.0,1.0,650,NULL,NULL,NULL,NULL,'A demo rental listing added for testing.','2026-08-13 08:00:47','2026-08-13 08:00:47');
/*!40000 ALTER TABLE `properties` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `property_media`
--

DROP TABLE IF EXISTS `property_media`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `property_media` (
  `media_id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `property_id` int(10) unsigned NOT NULL,
  `media_type` enum('image','video','link') NOT NULL,
  `file_path` varchar(500) NOT NULL,
  `is_cover` tinyint(1) NOT NULL DEFAULT 0,
  `sort_order` tinyint(3) unsigned NOT NULL DEFAULT 0,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`media_id`),
  KEY `idx_media_property` (`property_id`,`media_type`,`is_cover`,`sort_order`),
  CONSTRAINT `fk_media_property` FOREIGN KEY (`property_id`) REFERENCES `properties` (`property_id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `property_media`
--

LOCK TABLES `property_media` WRITE;
/*!40000 ALTER TABLE `property_media` DISABLE KEYS */;
INSERT INTO `property_media` VALUES (1,1,'image','https://images.unsplash.com/photo-1600585152915-d208bec867a1?auto=format&fit=crop&w=900&q=85',1,0,'2026-08-13 07:14:38'),(2,2,'image','https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?auto=format&fit=crop&w=900&q=85',1,0,'2026-08-13 07:14:38'),(3,3,'image','https://images.unsplash.com/photo-1600607687920-4e2a09cf159d?auto=format&fit=crop&w=900&q=85',1,0,'2026-08-13 07:14:38'),(4,4,'image','https://images.unsplash.com/photo-1600566753086-00f18fb6b3ea?auto=format&fit=crop&w=900&q=85',1,0,'2026-08-13 07:14:38'),(5,5,'image','https://placehold.co/800x600',1,0,'2026-08-13 08:00:47');
/*!40000 ALTER TABLE `property_media` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `saved_properties`
--

DROP TABLE IF EXISTS `saved_properties`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `saved_properties` (
  `saved_property_id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `visitor_token` char(36) NOT NULL,
  `property_id` int(10) unsigned NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`saved_property_id`),
  UNIQUE KEY `uq_saved_property` (`visitor_token`,`property_id`),
  KEY `fk_saved_property` (`property_id`),
  CONSTRAINT `fk_saved_property` FOREIGN KEY (`property_id`) REFERENCES `properties` (`property_id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `saved_properties`
--

LOCK TABLES `saved_properties` WRITE;
/*!40000 ALTER TABLE `saved_properties` DISABLE KEYS */;
INSERT INTO `saved_properties` VALUES (1,'1793711e-96ed-11f1-a827-bbd3f03b54f6',5,'2026-08-13 08:00:47');
/*!40000 ALTER TABLE `saved_properties` ENABLE KEYS */;
UNLOCK TABLES;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2026-08-13 13:04:18
